/**
 * Integration tests for app/services/events.server.ts
 *
 * These tests run against a real PostgreSQL database (greenroom_test).
 * Prerequisites: Docker Compose Postgres running on port 5432.
 * Run with: pnpm test:integration
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../src/db/index.js";
import { eventAssignments, events } from "../../../src/db/schema.js";
import {
	assignToEvent,
	bulkAssignToEvent,
	createEvent,
	deleteEvent,
	getEventWithAssignments,
	getGroupEvents,
	getUserUpcomingEvents,
	removeAssignment,
	updateAssignmentStatus,
	updateEvent,
} from "../events.server.js";
import {
	addGroupMember,
	createTestAssignment,
	createTestEvent,
	createTestGroup,
	createTestUser,
} from "./seed.js";
import { cleanDatabase } from "./setup.js";

beforeEach(async () => {
	await cleanDatabase();
});

describe("events.server integration", () => {
	// --- createEvent ---

	describe("createEvent", () => {
		it("inserts an event and returns all fields with defaults", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const event = await createEvent({
				groupId: group.id,
				title: "  Friday Rehearsal  ",
				description: "  Weekly jam  ",
				eventType: "rehearsal",
				startTime: new Date("2026-04-10T19:00:00Z"),
				endTime: new Date("2026-04-10T21:00:00Z"),
				location: "  The Theater  ",
				createdById: user.id,
			});

			expect(event.id).toBeDefined();
			expect(event.groupId).toBe(group.id);
			expect(event.title).toBe("Friday Rehearsal"); // trimmed
			expect(event.description).toBe("Weekly jam"); // trimmed
			expect(event.location).toBe("The Theater"); // trimmed
			expect(event.eventType).toBe("rehearsal");
			expect(event.timezone).toBe("America/Los_Angeles"); // default
			expect(event.createdById).toBe(user.id);
			expect(event.callTime).toBeNull();
			expect(event.reminderSentAt).toBeNull();
			expect(event.createdAt).toBeInstanceOf(Date);
		});

		it("stores custom timezone when provided", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const event = await createEvent({
				groupId: group.id,
				title: "NYC Show",
				eventType: "show",
				startTime: new Date("2026-04-10T23:00:00Z"),
				endTime: new Date("2026-04-11T01:00:00Z"),
				createdById: user.id,
				timezone: "America/New_York",
				callTime: new Date("2026-04-10T22:00:00Z"),
			});

			expect(event.timezone).toBe("America/New_York");
			expect(event.callTime).toEqual(new Date("2026-04-10T22:00:00Z"));
		});

		it("sets description and location to null when empty strings provided", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const event = await createEvent({
				groupId: group.id,
				title: "Minimal Event",
				eventType: "other",
				startTime: new Date("2026-05-01T18:00:00Z"),
				endTime: new Date("2026-05-01T20:00:00Z"),
				createdById: user.id,
				description: "   ",
				location: "",
			});

			expect(event.description).toBeNull();
			expect(event.location).toBeNull();
		});

		it("links to availability request when createdFromRequestId is set", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const { createTestAvailabilityRequest } = await import("./seed.js");
			const request = await createTestAvailabilityRequest(group.id, user.id);

			const event = await createEvent({
				groupId: group.id,
				title: "From Availability",
				eventType: "rehearsal",
				startTime: new Date("2026-04-01T19:00:00Z"),
				endTime: new Date("2026-04-01T21:00:00Z"),
				createdById: user.id,
				createdFromRequestId: request.id,
			});

			expect(event.createdFromRequestId).toBe(request.id);
		});
	});

	// --- getGroupEvents ---

	describe("getGroupEvents", () => {
		it("returns events only for the specified group", async () => {
			const user = await createTestUser();
			const group1 = await createTestGroup(user.id);
			const group2 = await createTestGroup(user.id, { name: "Other Group" });

			await createTestEvent(group1.id, user.id, { title: "Group 1 Event" });
			await createTestEvent(group2.id, user.id, { title: "Group 2 Event" });

			const results = await getGroupEvents(group1.id);
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("Group 1 Event");
		});

		it("includes assignmentCount and confirmedCount", async () => {
			const admin = await createTestUser({ name: "Admin" });
			const member1 = await createTestUser({ name: "Member 1" });
			const member2 = await createTestUser({ name: "Member 2" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member1.id);
			await addGroupMember(group.id, member2.id);

			const event = await createTestEvent(group.id, admin.id);
			await createTestAssignment(event.id, member1.id, { status: "confirmed" });
			await createTestAssignment(event.id, member2.id, { status: "pending" });

			const results = await getGroupEvents(group.id);
			expect(results).toHaveLength(1);
			expect(results[0].assignmentCount).toBe(2);
			expect(results[0].confirmedCount).toBe(1);
		});

		it("filters upcoming events when option is set", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			// Past event
			await createTestEvent(group.id, user.id, {
				title: "Past",
				startTime: new Date("2020-01-01T12:00:00Z"),
				endTime: new Date("2020-01-01T14:00:00Z"),
			});
			// Future event
			await createTestEvent(group.id, user.id, {
				title: "Future",
				startTime: new Date("2030-06-01T12:00:00Z"),
				endTime: new Date("2030-06-01T14:00:00Z"),
			});

			const upcoming = await getGroupEvents(group.id, { upcoming: true });
			expect(upcoming).toHaveLength(1);
			expect(upcoming[0].title).toBe("Future");

			const all = await getGroupEvents(group.id);
			expect(all).toHaveLength(2);
		});

		it("filters by event type", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			await createTestEvent(group.id, user.id, { title: "Show", eventType: "show" });
			await createTestEvent(group.id, user.id, {
				title: "Rehearsal",
				eventType: "rehearsal",
			});

			const shows = await getGroupEvents(group.id, { eventType: "show" });
			expect(shows).toHaveLength(1);
			expect(shows[0].title).toBe("Show");
		});

		it("returns events sorted by startTime ascending", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			await createTestEvent(group.id, user.id, {
				title: "Later",
				startTime: new Date("2026-06-01T12:00:00Z"),
				endTime: new Date("2026-06-01T14:00:00Z"),
			});
			await createTestEvent(group.id, user.id, {
				title: "Earlier",
				startTime: new Date("2026-05-01T12:00:00Z"),
				endTime: new Date("2026-05-01T14:00:00Z"),
			});

			const results = await getGroupEvents(group.id);
			expect(results[0].title).toBe("Earlier");
			expect(results[1].title).toBe("Later");
		});

		it("returns empty array for group with no events", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const results = await getGroupEvents(group.id);
			expect(results).toEqual([]);
		});
	});

	// --- getEventWithAssignments ---

	describe("getEventWithAssignments", () => {
		it("returns event with creator name and assignments", async () => {
			const admin = await createTestUser({ name: "Jane Admin" });
			const member = await createTestUser({ name: "Bob Member" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);

			const event = await createTestEvent(group.id, admin.id, {
				title: "Show Night",
				eventType: "show",
			});
			await createTestAssignment(event.id, member.id, {
				role: "Performer",
				status: "confirmed",
			});

			const result = await getEventWithAssignments(event.id);
			expect(result).not.toBeNull();
			expect(result?.event.title).toBe("Show Night");
			expect(result?.event.createdByName).toBe("Jane Admin");
			expect(result?.assignments).toHaveLength(1);
			expect(result?.assignments[0].userName).toBe("Bob Member");
			expect(result?.assignments[0].role).toBe("Performer");
			expect(result?.assignments[0].status).toBe("confirmed");
		});

		it("returns 'Deleted user' when creator is deleted", async () => {
			const admin = await createTestUser({ name: "Will Delete" });
			const group = await createTestGroup(admin.id);
			const event = await createTestEvent(group.id, admin.id);

			// Simulate creator deletion (set null via FK ON DELETE SET NULL)
			await db.update(events).set({ createdById: null }).where(eq(events.id, event.id));

			const result = await getEventWithAssignments(event.id);
			expect(result?.event.createdByName).toBe("Deleted user");
		});

		it("returns null for non-existent event", async () => {
			const result = await getEventWithAssignments("00000000-0000-0000-0000-000000000000");
			expect(result).toBeNull();
		});

		it("returns event with empty assignments array when none exist", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const event = await createTestEvent(group.id, user.id);

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments).toEqual([]);
		});

		it("sorts assignments by user name", async () => {
			const admin = await createTestUser({ name: "Admin" });
			const zara = await createTestUser({ name: "Zara" });
			const alice = await createTestUser({ name: "Alice" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, zara.id);
			await addGroupMember(group.id, alice.id);

			const event = await createTestEvent(group.id, admin.id);
			await createTestAssignment(event.id, zara.id);
			await createTestAssignment(event.id, alice.id);

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments[0].userName).toBe("Alice");
			expect(result?.assignments[1].userName).toBe("Zara");
		});
	});

	// --- updateEvent ---

	describe("updateEvent", () => {
		it("updates specified fields without touching others", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const event = await createTestEvent(group.id, user.id, {
				title: "Original Title",
				location: "Original Location",
				eventType: "rehearsal",
			});

			const updated = await updateEvent(event.id, {
				title: "  New Title  ",
				description: "New description",
			});

			expect(updated.title).toBe("New Title"); // trimmed
			expect(updated.description).toBe("New description");
			expect(updated.location).toBe("Original Location"); // unchanged
			expect(updated.eventType).toBe("rehearsal"); // unchanged
		});

		it("resets reminder fields when startTime changes", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const event = await createTestEvent(group.id, user.id);

			// Simulate that reminders were already sent
			await db
				.update(events)
				.set({
					reminderSentAt: new Date(),
					confirmationReminderSentAt: new Date(),
				})
				.where(eq(events.id, event.id));

			const updated = await updateEvent(event.id, {
				startTime: new Date("2026-07-01T19:00:00Z"),
			});

			expect(updated.reminderSentAt).toBeNull();
			expect(updated.confirmationReminderSentAt).toBeNull();
		});

		it("does not reset reminders when only title changes", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const event = await createTestEvent(group.id, user.id);

			const reminderDate = new Date("2026-03-01T12:00:00Z");
			await db.update(events).set({ reminderSentAt: reminderDate }).where(eq(events.id, event.id));

			const updated = await updateEvent(event.id, { title: "New Title" });
			expect(updated.reminderSentAt).toEqual(reminderDate);
		});

		it("throws when updating non-existent event", async () => {
			await expect(
				updateEvent("00000000-0000-0000-0000-000000000000", { title: "No" }),
			).rejects.toThrow("Event not found.");
		});
	});

	// --- deleteEvent ---

	describe("deleteEvent", () => {
		it("removes the event from the database", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const event = await createTestEvent(group.id, user.id);

			await deleteEvent(event.id);

			const result = await getEventWithAssignments(event.id);
			expect(result).toBeNull();
		});

		it("cascades delete to assignments", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);
			const event = await createTestEvent(group.id, admin.id);
			await createTestAssignment(event.id, member.id);

			await deleteEvent(event.id);

			const assignments = await db
				.select()
				.from(eventAssignments)
				.where(eq(eventAssignments.eventId, event.id));
			expect(assignments).toHaveLength(0);
		});
	});

	// --- Assignment operations ---

	describe("assignToEvent", () => {
		it("creates assignment with pending status", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);
			const event = await createTestEvent(group.id, admin.id);

			await assignToEvent(event.id, member.id, "Performer");

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments).toHaveLength(1);
			expect(result?.assignments[0].userId).toBe(member.id);
			expect(result?.assignments[0].role).toBe("Performer");
			expect(result?.assignments[0].status).toBe("pending");
		});

		it("is idempotent — duplicate assign does not throw", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);
			const event = await createTestEvent(group.id, admin.id);

			await assignToEvent(event.id, member.id, "Performer");
			await assignToEvent(event.id, member.id, "Performer"); // should not throw

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments).toHaveLength(1); // still just one
		});
	});

	describe("bulkAssignToEvent", () => {
		it("assigns multiple users at once", async () => {
			const admin = await createTestUser();
			const m1 = await createTestUser({ name: "Member 1" });
			const m2 = await createTestUser({ name: "Member 2" });
			const m3 = await createTestUser({ name: "Member 3" });
			const group = await createTestGroup(admin.id);
			const event = await createTestEvent(group.id, admin.id);

			await bulkAssignToEvent(event.id, [m1.id, m2.id, m3.id], "Performer");

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments).toHaveLength(3);
			expect(result?.assignments.every((a) => a.role === "Performer")).toBe(true);
		});

		it("handles empty array without error", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const event = await createTestEvent(group.id, user.id);

			await bulkAssignToEvent(event.id, []);
			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments).toHaveLength(0);
		});

		it("skips duplicates via onConflictDoNothing", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			const event = await createTestEvent(group.id, admin.id);

			await assignToEvent(event.id, member.id);
			await bulkAssignToEvent(event.id, [member.id]); // duplicate

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments).toHaveLength(1);
		});
	});

	describe("removeAssignment", () => {
		it("removes a specific user's assignment", async () => {
			const admin = await createTestUser();
			const m1 = await createTestUser({ name: "Stay" });
			const m2 = await createTestUser({ name: "Remove" });
			const group = await createTestGroup(admin.id);
			const event = await createTestEvent(group.id, admin.id);

			await createTestAssignment(event.id, m1.id);
			await createTestAssignment(event.id, m2.id);

			await removeAssignment(event.id, m2.id);

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments).toHaveLength(1);
			expect(result?.assignments[0].userName).toBe("Stay");
		});
	});

	describe("updateAssignmentStatus", () => {
		it("updates status to confirmed", async () => {
			const admin = await createTestUser();
			const member = await createTestUser({ name: "Member" });
			const group = await createTestGroup(admin.id);
			const event = await createTestEvent(group.id, admin.id);
			await createTestAssignment(event.id, member.id);

			await updateAssignmentStatus(event.id, member.id, "confirmed");

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments[0].status).toBe("confirmed");
		});

		it("updates status to declined", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			const event = await createTestEvent(group.id, admin.id);
			await createTestAssignment(event.id, member.id);

			await updateAssignmentStatus(event.id, member.id, "declined");

			const result = await getEventWithAssignments(event.id);
			expect(result?.assignments[0].status).toBe("declined");
		});
	});

	// --- getUserUpcomingEvents ---

	describe("getUserUpcomingEvents", () => {
		it("returns upcoming events across groups the user belongs to", async () => {
			const user = await createTestUser();
			const group1 = await createTestGroup(user.id, { name: "Group A" });
			const user2 = await createTestUser();
			const group2 = await createTestGroup(user2.id, { name: "Group B" });
			await addGroupMember(group2.id, user.id);

			await createTestEvent(group1.id, user.id, {
				title: "Event in A",
				startTime: new Date("2030-01-01T12:00:00Z"),
				endTime: new Date("2030-01-01T14:00:00Z"),
			});
			await createTestEvent(group2.id, user2.id, {
				title: "Event in B",
				startTime: new Date("2030-02-01T12:00:00Z"),
				endTime: new Date("2030-02-01T14:00:00Z"),
			});

			const results = await getUserUpcomingEvents(user.id);
			expect(results).toHaveLength(2);
			expect(results[0].title).toBe("Event in A");
			expect(results[0].groupName).toBe("Group A");
			expect(results[1].title).toBe("Event in B");
			expect(results[1].groupName).toBe("Group B");
		});

		it("does not return past events", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			await createTestEvent(group.id, user.id, {
				title: "Past",
				startTime: new Date("2020-01-01T12:00:00Z"),
				endTime: new Date("2020-01-01T14:00:00Z"),
			});

			const results = await getUserUpcomingEvents(user.id);
			expect(results).toHaveLength(0);
		});

		it("includes user assignment status when assigned", async () => {
			const admin = await createTestUser({ name: "Admin" });
			const member = await createTestUser({ name: "Member" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);

			const event = await createTestEvent(group.id, admin.id, {
				startTime: new Date("2030-01-01T12:00:00Z"),
				endTime: new Date("2030-01-01T14:00:00Z"),
			});
			await createTestAssignment(event.id, member.id, { status: "confirmed" });

			const results = await getUserUpcomingEvents(member.id);
			expect(results).toHaveLength(1);
			expect(results[0].userStatus).toBe("confirmed");
		});

		it("returns null userStatus when not assigned", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			await createTestEvent(group.id, user.id, {
				startTime: new Date("2030-01-01T12:00:00Z"),
				endTime: new Date("2030-01-01T14:00:00Z"),
			});

			const results = await getUserUpcomingEvents(user.id);
			expect(results).toHaveLength(1);
			expect(results[0].userStatus).toBeNull();
		});

		it("respects the limit parameter", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			for (let i = 0; i < 10; i++) {
				await createTestEvent(group.id, user.id, {
					title: `Event ${i}`,
					startTime: new Date(`2030-0${(i % 9) + 1}-01T12:00:00Z`),
					endTime: new Date(`2030-0${(i % 9) + 1}-01T14:00:00Z`),
				});
			}

			const results = await getUserUpcomingEvents(user.id, 3);
			expect(results).toHaveLength(3);
		});
	});
});
