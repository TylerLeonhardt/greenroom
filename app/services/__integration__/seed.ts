/**
 * Test data factories for integration tests.
 *
 * Every factory returns the full row from the database (via RETURNING).
 * Unique fields (email, invite_code) are randomized to prevent collisions.
 */
import { db } from "../../../src/db/index.js";
import {
	availabilityRequests,
	availabilityResponses,
	DEFAULT_NOTIFICATION_PREFERENCES,
	eventAssignments,
	events,
	groupMemberships,
	groups,
	rsvpChanges,
	users,
} from "../../../src/db/schema.js";

type User = typeof users.$inferSelect;
type Group = typeof groups.$inferSelect;
type Event = typeof events.$inferSelect;
type AvailabilityRequest = typeof availabilityRequests.$inferSelect;
type RsvpChange = typeof rsvpChanges.$inferSelect;

let counter = 0;
function nextId(): string {
	return `${Date.now()}-${++counter}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Users ---

export async function createTestUser(
	overrides?: Partial<typeof users.$inferInsert>,
): Promise<User> {
	const uid = nextId();
	const [user] = await db
		.insert(users)
		.values({
			email: `test-${uid}@example.com`,
			name: overrides?.name ?? "Test User",
			emailVerified: true,
			...overrides,
		})
		.returning();
	// biome-ignore lint/style/noNonNullAssertion: Factory always returns a row
	return user!;
}

// --- Groups ---

const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomInviteCode(): string {
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
	}
	return code;
}

/** Creates a group AND adds the user as admin. */
export async function createTestGroup(
	userId: string,
	overrides?: Partial<typeof groups.$inferInsert>,
): Promise<Group> {
	const [group] = await db
		.insert(groups)
		.values({
			name: overrides?.name ?? "Test Group",
			inviteCode: overrides?.inviteCode ?? randomInviteCode(),
			createdById: userId,
			...overrides,
		})
		.returning();

	await db.insert(groupMemberships).values({
		// biome-ignore lint/style/noNonNullAssertion: Factory always returns a row
		groupId: group!.id,
		userId,
		role: "admin",
		notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
	});

	// biome-ignore lint/style/noNonNullAssertion: Factory always returns a row
	return group!;
}

/** Add a user as a member (not admin) of a group. */
export async function addGroupMember(groupId: string, userId: string): Promise<void> {
	await db.insert(groupMemberships).values({
		groupId,
		userId,
		role: "member",
		notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
	});
}

// --- Events ---

export async function createTestEvent(
	groupId: string,
	createdById: string,
	overrides?: Partial<typeof events.$inferInsert>,
): Promise<Event> {
	const now = new Date();
	const [event] = await db
		.insert(events)
		.values({
			groupId,
			title: overrides?.title ?? "Test Event",
			eventType: overrides?.eventType ?? "rehearsal",
			startTime: overrides?.startTime ?? new Date(now.getTime() + 86400000), // +1 day
			endTime: overrides?.endTime ?? new Date(now.getTime() + 86400000 + 7200000), // +1 day + 2h
			createdById,
			timezone: overrides?.timezone ?? "America/New_York",
			...overrides,
		})
		.returning();
	// biome-ignore lint/style/noNonNullAssertion: Factory always returns a row
	return event!;
}

// --- Availability ---

export async function createTestAvailabilityRequest(
	groupId: string,
	createdById: string,
	overrides?: Partial<typeof availabilityRequests.$inferInsert>,
): Promise<AvailabilityRequest> {
	const [request] = await db
		.insert(availabilityRequests)
		.values({
			groupId,
			title: overrides?.title ?? "Test Availability Request",
			dateRangeStart: overrides?.dateRangeStart ?? new Date("2026-04-01"),
			dateRangeEnd: overrides?.dateRangeEnd ?? new Date("2026-04-07"),
			requestedDates: overrides?.requestedDates ?? ["2026-04-01", "2026-04-02", "2026-04-03"],
			createdById,
			...overrides,
		})
		.returning();
	// biome-ignore lint/style/noNonNullAssertion: Factory always returns a row
	return request!;
}

export async function createTestAvailabilityResponse(
	requestId: string,
	userId: string,
	responses: Record<string, "available" | "maybe" | "not_available">,
): Promise<void> {
	await db.insert(availabilityResponses).values({
		requestId,
		userId,
		responses,
	});
}

// --- Assignments ---

export async function createTestAssignment(
	eventId: string,
	userId: string,
	overrides?: { role?: string; status?: "pending" | "confirmed" | "declined" },
): Promise<void> {
	await db.insert(eventAssignments).values({
		eventId,
		userId,
		role: overrides?.role ?? null,
		status: overrides?.status ?? "pending",
	});
}

// --- RSVP Changes ---

export async function createTestRsvpChange(
	eventId: string,
	userId: string,
	newStatus: "pending" | "confirmed" | "declined",
	overrides?: {
		previousStatus?: "pending" | "confirmed" | "declined" | null;
		changedAt?: Date;
	},
): Promise<RsvpChange> {
	const [change] = await db
		.insert(rsvpChanges)
		.values({
			eventId,
			userId,
			previousStatus: overrides?.previousStatus ?? null,
			newStatus,
			...(overrides?.changedAt ? { changedAt: overrides.changedAt } : {}),
		})
		.returning();
	// biome-ignore lint/style/noNonNullAssertion: Factory always returns a row
	return change!;
}
