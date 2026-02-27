import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import {
	availabilityRequests,
	eventAssignments,
	events,
	groupMemberships,
	groups,
} from "../../src/db/schema.js";

export async function getDashboardData(userId: string) {
	const [userGroups, upcomingEvents, pendingRequests, pendingConfirmations] = await Promise.all([
		// User's groups with member count and role
		db
			.select({
				id: groups.id,
				name: groups.name,
				description: groups.description,
				inviteCode: groups.inviteCode,
				createdById: groups.createdById,
				createdAt: groups.createdAt,
				updatedAt: groups.updatedAt,
				role: groupMemberships.role,
				memberCount: sql<number>`cast(count(*) over (partition by ${groups.id}) as int)`,
			})
			.from(groupMemberships)
			.innerJoin(groups, eq(groupMemberships.groupId, groups.id))
			.where(eq(groupMemberships.userId, userId))
			.orderBy(groups.name),

		// Upcoming events across all groups (next 5)
		db
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
			.limit(5),

		// Pending availability requests (open, user hasn't responded)
		db
			.select({
				id: availabilityRequests.id,
				title: availabilityRequests.title,
				groupId: availabilityRequests.groupId,
				groupName: groups.name,
				expiresAt: availabilityRequests.expiresAt,
				dateRangeStart: availabilityRequests.dateRangeStart,
				dateRangeEnd: availabilityRequests.dateRangeEnd,
			})
			.from(availabilityRequests)
			.innerJoin(groups, eq(availabilityRequests.groupId, groups.id))
			.innerJoin(
				groupMemberships,
				and(eq(groupMemberships.groupId, groups.id), eq(groupMemberships.userId, userId)),
			)
			.where(
				and(
					eq(availabilityRequests.status, "open"),
					sql`not exists (
						select 1 from availability_responses ar
						where ar.request_id = ${availabilityRequests.id}
						and ar.user_id = ${userId}
					)`,
				),
			)
			.orderBy(availabilityRequests.expiresAt),

		// Events where user is assigned with pending status
		db
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
				createdAt: events.createdAt,
				updatedAt: events.updatedAt,
				groupName: groups.name,
			})
			.from(eventAssignments)
			.innerJoin(events, eq(eventAssignments.eventId, events.id))
			.innerJoin(groups, eq(events.groupId, groups.id))
			.where(
				and(
					eq(eventAssignments.userId, userId),
					eq(eventAssignments.status, "pending"),
					gte(events.startTime, new Date()),
				),
			)
			.orderBy(events.startTime),
	]);

	// Format date ranges for pending requests
	const formattedPendingRequests = pendingRequests.map((r) => ({
		id: r.id,
		title: r.title,
		groupId: r.groupId,
		groupName: r.groupName,
		expiresAt: r.expiresAt,
		dateRange: formatDateRange(r.dateRangeStart, r.dateRangeEnd),
	}));

	return {
		groups: userGroups,
		upcomingEvents,
		pendingRequests: formattedPendingRequests,
		pendingConfirmations,
	};
}

function formatDateRange(start: Date, end: Date): string {
	const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
	const startStr = start.toLocaleDateString("en-US", opts);
	const endStr = end.toLocaleDateString("en-US", {
		...opts,
		year: "numeric",
	});
	return `${startStr} – ${endStr}`;
}
