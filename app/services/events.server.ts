import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import {
	availabilityRequests,
	availabilityResponses,
	eventAssignments,
	events,
	groupMemberships,
	groups,
	users,
} from "../../src/db/schema.js";
import { localTimeToUTC } from "../lib/date-utils.js";

type Event = typeof events.$inferSelect;

// --- Create ---

export async function createEvent(data: {
	groupId: string;
	title: string;
	description?: string;
	eventType: "rehearsal" | "show" | "other";
	startTime: Date;
	endTime: Date;
	location?: string;
	createdById: string;
	createdFromRequestId?: string;
	callTime?: Date;
}): Promise<Event> {
	const [event] = await db
		.insert(events)
		.values({
			groupId: data.groupId,
			title: data.title.trim(),
			description: data.description?.trim() || null,
			eventType: data.eventType,
			startTime: data.startTime,
			endTime: data.endTime,
			location: data.location?.trim() || null,
			createdById: data.createdById,
			createdFromRequestId: data.createdFromRequestId ?? null,
			callTime: data.callTime ?? null,
		})
		.returning();
	if (!event) throw new Error("Failed to create event.");
	return event;
}

export async function createEventsFromAvailability(data: {
	groupId: string;
	requestId: string;
	dates: Array<{ date: string; startTime: string; endTime: string }>;
	title: string;
	eventType: "rehearsal" | "show" | "other";
	location?: string;
	createdById: string;
	autoAssignAvailable?: boolean;
	timezone?: string | null;
}): Promise<Event[]> {
	const createdEvents: Event[] = [];

	for (const dateInfo of data.dates) {
		const startTime = localTimeToUTC(dateInfo.date, dateInfo.startTime, data.timezone);
		const endTime = localTimeToUTC(dateInfo.date, dateInfo.endTime, data.timezone);

		const event = await createEvent({
			groupId: data.groupId,
			title: data.title,
			eventType: data.eventType,
			startTime,
			endTime,
			location: data.location,
			createdById: data.createdById,
			createdFromRequestId: data.requestId,
		});

		if (data.autoAssignAvailable) {
			const responses = await db
				.select({
					userId: availabilityResponses.userId,
					responses: availabilityResponses.responses,
				})
				.from(availabilityResponses)
				.where(eq(availabilityResponses.requestId, data.requestId));

			const availableUserIds = responses
				.filter((r) => {
					const resp = r.responses as Record<string, string>;
					return resp[dateInfo.date] === "available";
				})
				.map((r) => r.userId);

			if (availableUserIds.length > 0) {
				await bulkAssignToEvent(event.id, availableUserIds);
			}
		}

		createdEvents.push(event);
	}

	return createdEvents;
}

// --- List ---

export async function getGroupEvents(
	groupId: string,
	options?: { upcoming?: boolean; eventType?: string },
): Promise<Array<Event & { assignmentCount: number; confirmedCount: number }>> {
	const conditions = [eq(events.groupId, groupId)];

	if (options?.upcoming) {
		conditions.push(gte(events.startTime, new Date()));
	}
	if (options?.eventType) {
		conditions.push(eq(events.eventType, options.eventType as "rehearsal" | "show" | "other"));
	}

	const rows = await db
		.select({
			id: events.id,
			groupId: events.groupId,
			title: events.title,
			description: events.description,
			eventType: events.eventType,
			startTime: events.startTime,
			endTime: events.endTime,
			location: events.location,
			createdById: events.createdById,
			createdFromRequestId: events.createdFromRequestId,
			callTime: events.callTime,
			createdAt: events.createdAt,
			updatedAt: events.updatedAt,
			assignmentCount: sql<number>`cast((
				select count(*) from event_assignments
				where event_assignments.event_id = ${events.id}
			) as int)`,
			confirmedCount: sql<number>`cast((
				select count(*) from event_assignments
				where event_assignments.event_id = ${events.id} and event_assignments.status = 'confirmed'
			) as int)`,
		})
		.from(events)
		.where(and(...conditions))
		.orderBy(events.startTime);

	return rows;
}

// --- Get Single with Assignments ---

export async function getEventWithAssignments(eventId: string): Promise<{
	event: Event & { createdByName: string };
	assignments: Array<{
		userId: string;
		userName: string;
		role: string | null;
		status: "pending" | "confirmed" | "declined";
		assignedAt: Date;
	}>;
} | null> {
	const [eventRow] = await db
		.select({
			id: events.id,
			groupId: events.groupId,
			title: events.title,
			description: events.description,
			eventType: events.eventType,
			startTime: events.startTime,
			endTime: events.endTime,
			location: events.location,
			createdById: events.createdById,
			createdFromRequestId: events.createdFromRequestId,
			callTime: events.callTime,
			createdAt: events.createdAt,
			updatedAt: events.updatedAt,
			createdByName: users.name,
		})
		.from(events)
		.leftJoin(users, eq(events.createdById, users.id))
		.where(eq(events.id, eventId))
		.limit(1);

	if (!eventRow) return null;
	const createdByName = eventRow.createdByName ?? "Deleted user";

	const assignments = await db
		.select({
			userId: eventAssignments.userId,
			userName: users.name,
			role: eventAssignments.role,
			status: eventAssignments.status,
			assignedAt: eventAssignments.assignedAt,
		})
		.from(eventAssignments)
		.innerJoin(users, eq(eventAssignments.userId, users.id))
		.where(eq(eventAssignments.eventId, eventId))
		.orderBy(users.name);

	return {
		event: { ...eventRow, createdByName },
		assignments: assignments as Array<{
			userId: string;
			userName: string;
			role: string | null;
			status: "pending" | "confirmed" | "declined";
			assignedAt: Date;
		}>,
	};
}

// --- Update ---

export async function updateEvent(
	eventId: string,
	data: Partial<{
		title: string;
		description: string;
		eventType: string;
		startTime: Date;
		endTime: Date;
		location: string;
		callTime: Date | null;
	}>,
): Promise<Event> {
	const [updated] = await db
		.update(events)
		.set({
			...(data.title !== undefined ? { title: data.title.trim() } : {}),
			...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
			...(data.eventType !== undefined
				? { eventType: data.eventType as "rehearsal" | "show" | "other" }
				: {}),
			...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
			...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
			...(data.location !== undefined ? { location: data.location.trim() || null } : {}),
			...(data.callTime !== undefined ? { callTime: data.callTime } : {}),
			updatedAt: new Date(),
		})
		.where(eq(events.id, eventId))
		.returning();
	if (!updated) throw new Error("Event not found.");
	return updated;
}

// --- Delete ---

export async function deleteEvent(eventId: string): Promise<void> {
	await db.delete(events).where(eq(events.id, eventId));
}

// --- Assignments ---

export async function assignToEvent(eventId: string, userId: string, role?: string): Promise<void> {
	await db
		.insert(eventAssignments)
		.values({
			eventId,
			userId,
			role: role ?? null,
			status: "pending",
		})
		.onConflictDoNothing();
}

export async function removeAssignment(eventId: string, userId: string): Promise<void> {
	await db
		.delete(eventAssignments)
		.where(and(eq(eventAssignments.eventId, eventId), eq(eventAssignments.userId, userId)));
}

export async function updateAssignmentStatus(
	eventId: string,
	userId: string,
	status: "confirmed" | "declined",
): Promise<void> {
	await db
		.update(eventAssignments)
		.set({ status })
		.where(and(eq(eventAssignments.eventId, eventId), eq(eventAssignments.userId, userId)));
}

export async function bulkAssignToEvent(
	eventId: string,
	userIds: string[],
	role?: string,
): Promise<void> {
	if (userIds.length === 0) return;
	await db
		.insert(eventAssignments)
		.values(
			userIds.map((userId) => ({
				eventId,
				userId,
				role: role ?? null,
				status: "pending" as const,
			})),
		)
		.onConflictDoNothing();
}

// --- User Events (cross-group) ---

export async function getUserUpcomingEvents(
	userId: string,
	limit = 5,
): Promise<Array<Event & { groupName: string; userStatus: string | null }>> {
	const rows = await db
		.select({
			id: events.id,
			groupId: events.groupId,
			title: events.title,
			description: events.description,
			eventType: events.eventType,
			startTime: events.startTime,
			endTime: events.endTime,
			location: events.location,
			createdById: events.createdById,
			createdFromRequestId: events.createdFromRequestId,
			callTime: events.callTime,
			createdAt: events.createdAt,
			updatedAt: events.updatedAt,
			groupName: groups.name,
			userStatus: sql<string | null>`(
				select ea.status from event_assignments ea
				where ea.event_id = ${events.id} and ea.user_id = ${userId}
				limit 1
			)`,
		})
		.from(events)
		.innerJoin(groups, eq(events.groupId, groups.id))
		.innerJoin(
			groupMemberships,
			and(eq(groupMemberships.groupId, groups.id), eq(groupMemberships.userId, userId)),
		)
		.where(gte(events.startTime, new Date()))
		.orderBy(events.startTime)
		.limit(limit);

	return rows;
}

// --- Availability request ownership check ---

export async function getAvailabilityRequestGroupId(requestId: string): Promise<string | null> {
	const [row] = await db
		.select({ groupId: availabilityRequests.groupId })
		.from(availabilityRequests)
		.where(eq(availabilityRequests.id, requestId))
		.limit(1);
	return row?.groupId ?? null;
}

// --- Availability data for cast suggestions ---

export async function getAvailabilityForEventDate(
	requestId: string,
	date: string,
): Promise<Array<{ userId: string; userName: string; status: string }>> {
	const responses = await db
		.select({
			userId: availabilityResponses.userId,
			userName: users.name,
			responses: availabilityResponses.responses,
		})
		.from(availabilityResponses)
		.innerJoin(users, eq(availabilityResponses.userId, users.id))
		.where(eq(availabilityResponses.requestId, requestId))
		.orderBy(users.name);

	return responses.map((r) => {
		const resp = r.responses as Record<string, string>;
		return {
			userId: r.userId,
			userName: r.userName,
			status: resp[date] ?? "no_response",
		};
	});
}
