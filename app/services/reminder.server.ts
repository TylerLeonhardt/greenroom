import { CronJob } from "cron";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import { eventAssignments, events, groupMemberships, groups, users } from "../../src/db/schema.js";
import { formatEventTime, formatTime } from "../lib/date-utils.js";
import { sendEventReminderNotification } from "./email.server.js";
import { logger } from "./logger.server.js";

/**
 * Start a cron job that sends reminder emails for upcoming events.
 *
 * Runs every 15 minutes. For each event starting within the next 24 hours
 * that hasn't had a reminder sent yet, emails all confirmed attendees
 * whose notification preferences allow it.
 *
 * Uses PostgreSQL advisory locks for multi-replica safety — only one
 * instance processes reminders at a time, preventing duplicate emails.
 */
let reminderJob: CronJob | null = null;

export function startReminderJob(): void {
	if (process.env.ENABLE_REMINDERS !== "true") {
		logger.info("Reminder job disabled (ENABLE_REMINDERS !== 'true')");
		return;
	}

	// Prevent duplicate jobs during HMR/hot reloads
	if (reminderJob) {
		logger.debug("Reminder job already running");
		return;
	}

	reminderJob = new CronJob("*/15 * * * *", async () => {
		try {
			await processReminders();
		} catch (error) {
			logger.error({ err: error }, "Reminder job failed");
		}
	});

	reminderJob.start();
	logger.info("Reminder job started (every 15 minutes)");
}

export async function processReminders(): Promise<void> {
	// Use a transaction with an advisory lock to prevent duplicate sends
	// when running multiple container replicas. pg_try_advisory_xact_lock
	// is non-blocking: if another replica holds the lock, we skip this run.
	await db.transaction(async (tx) => {
		const lockResult = await tx.execute(
			sql`SELECT pg_try_advisory_xact_lock(hashtext('reminder-job'))`,
		);
		const locked = (
			lockResult as unknown as { rows: Array<{ pg_try_advisory_xact_lock: boolean }> }
		).rows[0]?.pg_try_advisory_xact_lock;
		if (!locked) {
			logger.debug("Reminder job skipped — another instance holds the lock");
			return;
		}

		const now = new Date();
		const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

		// Find events starting within the next 24 hours that haven't had reminders sent.
		// For shows with a callTime, we check if callTime is within 24 hours instead.
		const upcomingEvents = await tx
			.select({
				id: events.id,
				groupId: events.groupId,
				title: events.title,
				eventType: events.eventType,
				startTime: events.startTime,
				endTime: events.endTime,
				location: events.location,
				callTime: events.callTime,
				groupName: groups.name,
			})
			.from(events)
			.innerJoin(groups, eq(events.groupId, groups.id))
			.where(
				and(
					isNull(events.reminderSentAt),
					// Event's effective start (callTime for shows, startTime otherwise)
					// must be within the next 24 hours and still in the future
					gte(sql`COALESCE(${events.callTime}, ${events.startTime})`, now),
					lte(sql`COALESCE(${events.callTime}, ${events.startTime})`, twentyFourHoursFromNow),
				),
			);

		if (upcomingEvents.length === 0) {
			logger.debug("No events needing reminders");
			return;
		}

		logger.info({ count: upcomingEvents.length }, "Processing event reminders");

		const appUrl = process.env.APP_URL || "https://mycalltime.app";

		for (const event of upcomingEvents) {
			// Get confirmed attendees with their notification preferences
			const attendees = await tx
				.select({
					userId: eventAssignments.userId,
					email: users.email,
					name: users.name,
					timezone: users.timezone,
					notificationPreferences: groupMemberships.notificationPreferences,
				})
				.from(eventAssignments)
				.innerJoin(users, eq(eventAssignments.userId, users.id))
				.innerJoin(
					groupMemberships,
					and(
						eq(groupMemberships.groupId, event.groupId),
						eq(groupMemberships.userId, eventAssignments.userId),
					),
				)
				.where(
					and(eq(eventAssignments.eventId, event.id), eq(eventAssignments.status, "confirmed")),
				);

			const eventUrl = `${appUrl}/groups/${event.groupId}/events/${event.id}`;
			const preferencesUrl = `${appUrl}/groups/${event.groupId}/settings`;

			for (const attendee of attendees) {
				// Format times in each attendee's timezone for accurate display
				const tz = attendee.timezone ?? undefined;
				const dateTime = formatEventTime(event.startTime, event.endTime, tz);
				const callTimeStr = event.callTime ? formatTime(event.callTime, tz) : null;

				void sendEventReminderNotification({
					eventTitle: event.title,
					eventType: event.eventType,
					dateTime,
					location: event.location,
					callTime: callTimeStr,
					groupName: event.groupName,
					recipient: {
						email: attendee.email,
						name: attendee.name,
						notificationPreferences: attendee.notificationPreferences,
					},
					eventUrl,
					preferencesUrl,
				});
			}

			// Mark reminder as sent
			await tx.update(events).set({ reminderSentAt: new Date() }).where(eq(events.id, event.id));

			logger.info(
				{ eventId: event.id, attendeeCount: attendees.length },
				"Reminder emails queued for event",
			);
		}
	});
}
