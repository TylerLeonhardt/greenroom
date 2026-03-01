import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock the DB layer before importing the module under test ---

const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({
	returning: mockReturning,
	onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
});
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
const mockSet = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();

vi.mock("../../src/db/index.js", () => ({
	db: {
		select: mockSelect,
		from: mockFrom,
		where: mockWhere,
		innerJoin: mockInnerJoin,
		orderBy: mockOrderBy,
		limit: mockLimit,
		insert: mockInsert,
		values: mockValues,
		returning: mockReturning,
		update: mockUpdate,
		set: mockSet,
		delete: mockDelete,
	},
}));

// Mock date-utils to isolate from timezone logic
vi.mock("../lib/date-utils.js", () => ({
	localTimeToUTC: vi.fn(
		(dateStr: string, timeStr: string) => new Date(`${dateStr}T${timeStr}:00Z`),
	),
}));

const {
	createEvent,
	createEventsFromAvailability,
	getGroupEvents,
	getEventWithAssignments,
	updateEvent,
	deleteEvent,
	assignToEvent,
	removeAssignment,
	updateAssignmentStatus,
	bulkAssignToEvent,
	getUserUpcomingEvents,
	getAvailabilityRequestGroupId,
	getAvailabilityForEventDate,
} = await import("~/services/events.server");

const { localTimeToUTC } = await import("../lib/date-utils.js");

// --- Test fixtures ---

const now = new Date("2026-03-01T12:00:00Z");
const later = new Date("2026-03-01T14:00:00Z");

const mockEvent = {
	id: "event-1",
	groupId: "group-1",
	title: "Rehearsal",
	description: null,
	eventType: "rehearsal" as const,
	startTime: now,
	endTime: later,
	location: null,
	createdById: "user-1",
	createdFromRequestId: null,
	callTime: null,
	reminderSentAt: null,
	createdAt: now,
	updatedAt: now,
};

// --- Helpers ---

/** Build a chainable mock that simulates db.select().from().where()... etc. */
function chainMock(resolved: unknown) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.limit = vi.fn().mockResolvedValue(resolved);
	chain.orderBy = vi.fn().mockReturnValue(chain);
	chain.innerJoin = vi.fn().mockReturnValue(chain);
	chain.leftJoin = vi.fn().mockReturnValue(chain);
	chain.where = vi.fn().mockReturnValue(chain);
	chain.from = vi.fn().mockReturnValue(chain);
	return chain;
}

// --- Tests ---

describe("events.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ============================================================
	// createEvent
	// ============================================================
	describe("createEvent", () => {
		it("inserts event with correct fields and returns it", async () => {
			mockReturning.mockResolvedValueOnce([mockEvent]);

			const result = await createEvent({
				groupId: "group-1",
				title: "  Rehearsal  ",
				eventType: "rehearsal",
				startTime: now,
				endTime: later,
				createdById: "user-1",
			});

			expect(mockInsert).toHaveBeenCalled();
			expect(mockValues).toHaveBeenCalledWith(
				expect.objectContaining({
					groupId: "group-1",
					title: "Rehearsal", // trimmed
					eventType: "rehearsal",
					startTime: now,
					endTime: later,
					createdById: "user-1",
					description: null,
					location: null,
					createdFromRequestId: null,
					callTime: null,
				}),
			);
			expect(result).toEqual(mockEvent);
		});

		it("trims title and description", async () => {
			mockReturning.mockResolvedValueOnce([mockEvent]);

			await createEvent({
				groupId: "group-1",
				title: "  My Show  ",
				description: "  A great show  ",
				eventType: "show",
				startTime: now,
				endTime: later,
				createdById: "user-1",
			});

			expect(mockValues).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "My Show",
					description: "A great show",
				}),
			);
		});

		it("sets description to null when empty/whitespace", async () => {
			mockReturning.mockResolvedValueOnce([mockEvent]);

			await createEvent({
				groupId: "group-1",
				title: "Event",
				description: "   ",
				eventType: "other",
				startTime: now,
				endTime: later,
				createdById: "user-1",
			});

			expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
		});

		it("sets location to null when empty/whitespace", async () => {
			mockReturning.mockResolvedValueOnce([mockEvent]);

			await createEvent({
				groupId: "group-1",
				title: "Event",
				location: "  ",
				eventType: "other",
				startTime: now,
				endTime: later,
				createdById: "user-1",
			});

			expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
		});

		it("passes through optional fields when provided", async () => {
			const callTime = new Date("2026-03-01T11:00:00Z");
			mockReturning.mockResolvedValueOnce([{ ...mockEvent, callTime }]);

			await createEvent({
				groupId: "group-1",
				title: "Show Night",
				eventType: "show",
				startTime: now,
				endTime: later,
				location: "Theater",
				createdById: "user-1",
				createdFromRequestId: "req-1",
				callTime,
			});

			expect(mockValues).toHaveBeenCalledWith(
				expect.objectContaining({
					location: "Theater",
					createdFromRequestId: "req-1",
					callTime,
				}),
			);
		});

		it("throws when insert returns empty array", async () => {
			mockReturning.mockResolvedValueOnce([]);

			await expect(
				createEvent({
					groupId: "group-1",
					title: "Event",
					eventType: "rehearsal",
					startTime: now,
					endTime: later,
					createdById: "user-1",
				}),
			).rejects.toThrow("Failed to create event.");
		});
	});

	// ============================================================
	// getGroupEvents
	// ============================================================
	describe("getGroupEvents", () => {
		it("returns events for a group ordered by startTime", async () => {
			const rows = [{ ...mockEvent, assignmentCount: 3, confirmedCount: 2 }];
			const chain = chainMock(rows);
			// getGroupEvents doesn't call .limit(), it ends at .orderBy()
			chain.orderBy = vi.fn().mockResolvedValue(rows);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getGroupEvents("group-1");

			expect(mockSelect).toHaveBeenCalled();
			expect(result).toEqual(rows);
			expect(result[0].assignmentCount).toBe(3);
			expect(result[0].confirmedCount).toBe(2);
		});

		it("applies upcoming filter when specified", async () => {
			const chain = chainMock([]);
			chain.orderBy = vi.fn().mockResolvedValue([]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			await getGroupEvents("group-1", { upcoming: true });

			expect(chain.where).toHaveBeenCalled();
		});

		it("applies eventType filter when specified", async () => {
			const chain = chainMock([]);
			chain.orderBy = vi.fn().mockResolvedValue([]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			await getGroupEvents("group-1", { eventType: "show" });

			expect(chain.where).toHaveBeenCalled();
		});

		it("applies both upcoming and eventType filters", async () => {
			const chain = chainMock([]);
			chain.orderBy = vi.fn().mockResolvedValue([]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			await getGroupEvents("group-1", { upcoming: true, eventType: "rehearsal" });

			expect(chain.where).toHaveBeenCalled();
		});

		it("returns empty array when no events exist", async () => {
			const chain = chainMock([]);
			chain.orderBy = vi.fn().mockResolvedValue([]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getGroupEvents("group-nonexistent");
			expect(result).toEqual([]);
		});
	});

	// ============================================================
	// getEventWithAssignments
	// ============================================================
	describe("getEventWithAssignments", () => {
		it("returns event with assignments when event exists", async () => {
			const eventRow = { ...mockEvent, createdByName: "Alice" };
			const assignments = [
				{
					userId: "user-2",
					userName: "Bob",
					role: "Performer",
					status: "confirmed",
					assignedAt: now,
				},
			];

			// First select chain: event query
			const eventChain = chainMock(null);
			eventChain.limit = vi.fn().mockResolvedValue([eventRow]);
			eventChain.where = vi.fn().mockReturnValue(eventChain);
			eventChain.leftJoin = vi.fn().mockReturnValue(eventChain);
			eventChain.from = vi.fn().mockReturnValue(eventChain);

			// Second select chain: assignments query
			const assignChain = chainMock(null);
			assignChain.orderBy = vi.fn().mockResolvedValue(assignments);
			assignChain.where = vi.fn().mockReturnValue(assignChain);
			assignChain.innerJoin = vi.fn().mockReturnValue(assignChain);
			assignChain.from = vi.fn().mockReturnValue(assignChain);

			mockSelect.mockReturnValueOnce(eventChain).mockReturnValueOnce(assignChain);

			const result = await getEventWithAssignments("event-1");

			expect(result).not.toBeNull();
			// biome-ignore lint/style/noNonNullAssertion: guarded by assertion above
			const data = result!;
			expect(data.event.title).toBe("Rehearsal");
			expect(data.event.createdByName).toBe("Alice");
			expect(data.assignments).toHaveLength(1);
			expect(data.assignments[0].userName).toBe("Bob");
			expect(data.assignments[0].role).toBe("Performer");
			expect(data.assignments[0].status).toBe("confirmed");
		});

		it("returns null when event does not exist", async () => {
			const eventChain = chainMock(null);
			eventChain.limit = vi.fn().mockResolvedValue([]);
			eventChain.where = vi.fn().mockReturnValue(eventChain);
			eventChain.leftJoin = vi.fn().mockReturnValue(eventChain);
			eventChain.from = vi.fn().mockReturnValue(eventChain);
			mockSelect.mockReturnValueOnce(eventChain);

			const result = await getEventWithAssignments("nonexistent");

			expect(result).toBeNull();
		});

		it("returns event with empty assignments array", async () => {
			const eventRow = { ...mockEvent, createdByName: "Alice" };

			const eventChain = chainMock(null);
			eventChain.limit = vi.fn().mockResolvedValue([eventRow]);
			eventChain.where = vi.fn().mockReturnValue(eventChain);
			eventChain.leftJoin = vi.fn().mockReturnValue(eventChain);
			eventChain.from = vi.fn().mockReturnValue(eventChain);

			const assignChain = chainMock(null);
			assignChain.orderBy = vi.fn().mockResolvedValue([]);
			assignChain.where = vi.fn().mockReturnValue(assignChain);
			assignChain.innerJoin = vi.fn().mockReturnValue(assignChain);
			assignChain.from = vi.fn().mockReturnValue(assignChain);

			mockSelect.mockReturnValueOnce(eventChain).mockReturnValueOnce(assignChain);

			const result = await getEventWithAssignments("event-1");

			expect(result).not.toBeNull();
			// biome-ignore lint/style/noNonNullAssertion: guarded by assertion above
			expect(result!.assignments).toEqual([]);
		});
	});

	// ============================================================
	// updateEvent
	// ============================================================
	describe("updateEvent", () => {
		it("updates event and returns updated record", async () => {
			const updated = { ...mockEvent, title: "Updated Title" };
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([updated]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			const result = await updateEvent("event-1", { title: "  Updated Title  " });

			expect(mockUpdate).toHaveBeenCalled();
			expect(result.title).toBe("Updated Title");
		});

		it("trims title and description on update", async () => {
			const updated = { ...mockEvent, title: "New", description: "Desc" };
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([updated]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			await updateEvent("event-1", {
				title: "  New  ",
				description: "  Desc  ",
			});

			expect(mockSet).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "New",
					description: "Desc",
				}),
			);
		});

		it("sets description to null when empty string", async () => {
			const updated = { ...mockEvent, description: null };
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([updated]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			await updateEvent("event-1", { description: "" });

			expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
		});

		it("sets location to null when empty string", async () => {
			const updated = { ...mockEvent, location: null };
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([updated]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			await updateEvent("event-1", { location: "" });

			expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
		});

		it("supports setting callTime to null", async () => {
			const updated = { ...mockEvent, callTime: null };
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([updated]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			await updateEvent("event-1", { callTime: null });

			expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ callTime: null }));
		});

		it("throws when event not found", async () => {
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			await expect(updateEvent("nonexistent", { title: "X" })).rejects.toThrow("Event not found.");
		});

		it("only includes provided fields in update", async () => {
			const updated = { ...mockEvent, title: "Only Title" };
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([updated]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			await updateEvent("event-1", { title: "Only Title" });

			const setArg = mockSet.mock.calls[0][0];
			expect(setArg).toHaveProperty("title", "Only Title");
			expect(setArg).not.toHaveProperty("description");
			expect(setArg).not.toHaveProperty("location");
			expect(setArg).toHaveProperty("updatedAt"); // always set
		});

		it("resets reminderSentAt when startTime is updated", async () => {
			const newStart = new Date("2026-03-10T19:00:00Z");
			const updated = { ...mockEvent, startTime: newStart };
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([updated]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			await updateEvent("event-1", { startTime: newStart });

			const setArg = mockSet.mock.calls[0][0];
			expect(setArg).toHaveProperty("startTime", newStart);
			expect(setArg).toHaveProperty("reminderSentAt", null);
		});

		it("does not reset reminderSentAt when startTime is not changed", async () => {
			const updated = { ...mockEvent, title: "New Title" };
			const chain = chainMock(null);
			chain.returning = vi.fn().mockResolvedValue([updated]);
			chain.where = vi.fn().mockReturnValue(chain);
			mockSet.mockReturnValueOnce(chain);

			await updateEvent("event-1", { title: "New Title" });

			const setArg = mockSet.mock.calls[0][0];
			expect(setArg).not.toHaveProperty("reminderSentAt");
		});
	});

	// ============================================================
	// deleteEvent
	// ============================================================
	describe("deleteEvent", () => {
		it("deletes event by id", async () => {
			await deleteEvent("event-1");

			expect(mockDelete).toHaveBeenCalled();
			expect(mockDeleteWhere).toHaveBeenCalled();
		});
	});

	// ============================================================
	// assignToEvent
	// ============================================================
	describe("assignToEvent", () => {
		it("creates assignment with pending status", async () => {
			await assignToEvent("event-1", "user-1");

			expect(mockInsert).toHaveBeenCalled();
			expect(mockValues).toHaveBeenCalledWith(
				expect.objectContaining({
					eventId: "event-1",
					userId: "user-1",
					role: null,
					status: "pending",
				}),
			);
		});

		it("passes role when provided", async () => {
			await assignToEvent("event-1", "user-1", "Performer");

			expect(mockValues).toHaveBeenCalledWith(
				expect.objectContaining({
					role: "Performer",
					status: "pending",
				}),
			);
		});

		it("uses onConflictDoNothing for duplicate assignments", async () => {
			const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
			mockValues.mockReturnValueOnce({
				returning: mockReturning,
				onConflictDoNothing,
			});

			await assignToEvent("event-1", "user-1");

			expect(onConflictDoNothing).toHaveBeenCalled();
		});
	});

	// ============================================================
	// removeAssignment
	// ============================================================
	describe("removeAssignment", () => {
		it("deletes assignment by eventId and userId", async () => {
			await removeAssignment("event-1", "user-1");

			expect(mockDelete).toHaveBeenCalled();
			expect(mockDeleteWhere).toHaveBeenCalled();
		});
	});

	// ============================================================
	// updateAssignmentStatus
	// ============================================================
	describe("updateAssignmentStatus", () => {
		it("updates status to confirmed", async () => {
			const chain = chainMock(null);
			chain.where = vi.fn().mockResolvedValue(undefined);
			mockSet.mockReturnValueOnce(chain);

			await updateAssignmentStatus("event-1", "user-1", "confirmed");

			expect(mockUpdate).toHaveBeenCalled();
			expect(mockSet).toHaveBeenCalledWith({ status: "confirmed" });
		});

		it("updates status to declined", async () => {
			const chain = chainMock(null);
			chain.where = vi.fn().mockResolvedValue(undefined);
			mockSet.mockReturnValueOnce(chain);

			await updateAssignmentStatus("event-1", "user-1", "declined");

			expect(mockSet).toHaveBeenCalledWith({ status: "declined" });
		});
	});

	// ============================================================
	// bulkAssignToEvent
	// ============================================================
	describe("bulkAssignToEvent", () => {
		it("assigns multiple users in a single insert", async () => {
			const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
			mockValues.mockReturnValueOnce({
				returning: mockReturning,
				onConflictDoNothing,
			});

			await bulkAssignToEvent("event-1", ["user-1", "user-2", "user-3"]);

			expect(mockInsert).toHaveBeenCalled();
			expect(mockValues).toHaveBeenCalledWith([
				{ eventId: "event-1", userId: "user-1", role: null, status: "pending" },
				{ eventId: "event-1", userId: "user-2", role: null, status: "pending" },
				{ eventId: "event-1", userId: "user-3", role: null, status: "pending" },
			]);
			expect(onConflictDoNothing).toHaveBeenCalled();
		});

		it("sets role when provided", async () => {
			const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
			mockValues.mockReturnValueOnce({
				returning: mockReturning,
				onConflictDoNothing,
			});

			await bulkAssignToEvent("event-1", ["user-1"], "Performer");

			expect(mockValues).toHaveBeenCalledWith([
				{ eventId: "event-1", userId: "user-1", role: "Performer", status: "pending" },
			]);
		});

		it("does nothing for empty userIds array", async () => {
			await bulkAssignToEvent("event-1", []);

			expect(mockInsert).not.toHaveBeenCalled();
		});

		it("uses onConflictDoNothing for idempotent bulk assign", async () => {
			const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
			mockValues.mockReturnValueOnce({
				returning: mockReturning,
				onConflictDoNothing,
			});

			await bulkAssignToEvent("event-1", ["user-1"]);

			expect(onConflictDoNothing).toHaveBeenCalled();
		});
	});

	// ============================================================
	// getUserUpcomingEvents
	// ============================================================
	describe("getUserUpcomingEvents", () => {
		it("returns upcoming events across all user groups", async () => {
			const rows = [{ ...mockEvent, groupName: "Improv Team", userStatus: "confirmed" }];
			const chain = chainMock(null);
			chain.limit = vi.fn().mockResolvedValue(rows);
			chain.orderBy = vi.fn().mockReturnValue(chain);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.innerJoin = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getUserUpcomingEvents("user-1");

			expect(result).toHaveLength(1);
			expect(result[0].groupName).toBe("Improv Team");
			expect(result[0].userStatus).toBe("confirmed");
			expect(chain.limit).toHaveBeenCalledWith(5); // default limit
		});

		it("respects custom limit parameter", async () => {
			const chain = chainMock(null);
			chain.limit = vi.fn().mockResolvedValue([]);
			chain.orderBy = vi.fn().mockReturnValue(chain);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.innerJoin = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			await getUserUpcomingEvents("user-1", 10);

			expect(chain.limit).toHaveBeenCalledWith(10);
		});

		it("returns empty array when user has no upcoming events", async () => {
			const chain = chainMock(null);
			chain.limit = vi.fn().mockResolvedValue([]);
			chain.orderBy = vi.fn().mockReturnValue(chain);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.innerJoin = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getUserUpcomingEvents("user-1");

			expect(result).toEqual([]);
		});

		it("includes userStatus as null for unassigned events", async () => {
			const rows = [{ ...mockEvent, groupName: "Team", userStatus: null }];
			const chain = chainMock(null);
			chain.limit = vi.fn().mockResolvedValue(rows);
			chain.orderBy = vi.fn().mockReturnValue(chain);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.innerJoin = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getUserUpcomingEvents("user-1");

			expect(result[0].userStatus).toBeNull();
		});
	});

	// ============================================================
	// createEventsFromAvailability
	// ============================================================
	describe("createEventsFromAvailability", () => {
		it("creates events for each date using localTimeToUTC", async () => {
			// Each createEvent call goes through insert -> values -> returning
			mockReturning
				.mockResolvedValueOnce([{ ...mockEvent, id: "event-a" }])
				.mockResolvedValueOnce([{ ...mockEvent, id: "event-b" }]);

			const result = await createEventsFromAvailability({
				groupId: "group-1",
				requestId: "req-1",
				dates: [
					{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" },
					{ date: "2026-03-16", startTime: "18:00", endTime: "20:00" },
				],
				title: "Rehearsal",
				eventType: "rehearsal",
				createdById: "user-1",
			});

			expect(result).toHaveLength(2);
			expect(localTimeToUTC).toHaveBeenCalledTimes(4); // 2 dates × 2 (start+end)
			expect(localTimeToUTC).toHaveBeenCalledWith("2026-03-15", "19:00", undefined);
			expect(localTimeToUTC).toHaveBeenCalledWith("2026-03-15", "21:00", undefined);
		});

		it("passes timezone to localTimeToUTC", async () => {
			mockReturning.mockResolvedValueOnce([mockEvent]);

			await createEventsFromAvailability({
				groupId: "group-1",
				requestId: "req-1",
				dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
				title: "Show",
				eventType: "show",
				createdById: "user-1",
				timezone: "America/Los_Angeles",
			});

			expect(localTimeToUTC).toHaveBeenCalledWith("2026-03-15", "19:00", "America/Los_Angeles");
		});

		it("links created events to the availability request", async () => {
			mockReturning.mockResolvedValueOnce([mockEvent]);

			await createEventsFromAvailability({
				groupId: "group-1",
				requestId: "req-99",
				dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
				title: "Event",
				eventType: "other",
				createdById: "user-1",
			});

			expect(mockValues).toHaveBeenCalledWith(
				expect.objectContaining({ createdFromRequestId: "req-99" }),
			);
		});

		it("auto-assigns available users when autoAssignAvailable is true", async () => {
			// createEvent insert
			mockReturning.mockResolvedValueOnce([{ ...mockEvent, id: "event-new" }]);

			// availability responses query (for auto-assign)
			const respChain = chainMock(null);
			respChain.where = vi.fn().mockResolvedValue([
				{
					userId: "user-2",
					responses: { "2026-03-15": "available" },
				},
				{
					userId: "user-3",
					responses: { "2026-03-15": "maybe" },
				},
				{
					userId: "user-4",
					responses: { "2026-03-15": "available" },
				},
			]);
			respChain.from = vi.fn().mockReturnValue(respChain);
			mockSelect.mockReturnValueOnce(respChain);

			// bulkAssignToEvent insert
			const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
			mockValues.mockReturnValueOnce({
				returning: mockReturning,
				onConflictDoNothing,
			});

			await createEventsFromAvailability({
				groupId: "group-1",
				requestId: "req-1",
				dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
				title: "Rehearsal",
				eventType: "rehearsal",
				createdById: "user-1",
				autoAssignAvailable: true,
			});

			// Should assign only user-2 and user-4 (available), not user-3 (maybe)
			expect(mockValues).toHaveBeenLastCalledWith([
				expect.objectContaining({ userId: "user-2" }),
				expect.objectContaining({ userId: "user-4" }),
			]);
		});

		it("skips auto-assign when no users are available", async () => {
			mockReturning.mockResolvedValueOnce([mockEvent]);

			const respChain = chainMock(null);
			respChain.where = vi
				.fn()
				.mockResolvedValue([{ userId: "user-2", responses: { "2026-03-15": "not_available" } }]);
			respChain.from = vi.fn().mockReturnValue(respChain);
			mockSelect.mockReturnValueOnce(respChain);

			await createEventsFromAvailability({
				groupId: "group-1",
				requestId: "req-1",
				dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
				title: "Rehearsal",
				eventType: "rehearsal",
				createdById: "user-1",
				autoAssignAvailable: true,
			});

			// insert called once for createEvent, NOT for bulkAssign
			expect(mockInsert).toHaveBeenCalledTimes(1);
		});

		it("does not query responses when autoAssignAvailable is false", async () => {
			mockReturning.mockResolvedValueOnce([mockEvent]);

			await createEventsFromAvailability({
				groupId: "group-1",
				requestId: "req-1",
				dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
				title: "Rehearsal",
				eventType: "rehearsal",
				createdById: "user-1",
				autoAssignAvailable: false,
			});

			// select should not be called (no response lookup)
			expect(mockSelect).not.toHaveBeenCalled();
		});

		it("returns empty array for empty dates", async () => {
			const result = await createEventsFromAvailability({
				groupId: "group-1",
				requestId: "req-1",
				dates: [],
				title: "Event",
				eventType: "other",
				createdById: "user-1",
			});

			expect(result).toEqual([]);
			expect(mockInsert).not.toHaveBeenCalled();
		});
	});

	// ============================================================
	// getAvailabilityRequestGroupId
	// ============================================================
	describe("getAvailabilityRequestGroupId", () => {
		it("returns groupId when request exists", async () => {
			const chain = chainMock(null);
			chain.limit = vi.fn().mockResolvedValue([{ groupId: "group-1" }]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getAvailabilityRequestGroupId("req-1");

			expect(result).toBe("group-1");
		});

		it("returns null when request does not exist", async () => {
			const chain = chainMock(null);
			chain.limit = vi.fn().mockResolvedValue([]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getAvailabilityRequestGroupId("nonexistent");

			expect(result).toBeNull();
		});
	});

	// ============================================================
	// getAvailabilityForEventDate
	// ============================================================
	describe("getAvailabilityForEventDate", () => {
		it("returns user availability for a specific date", async () => {
			const chain = chainMock(null);
			chain.orderBy = vi.fn().mockResolvedValue([
				{
					userId: "user-1",
					userName: "Alice",
					responses: { "2026-03-15": "available", "2026-03-16": "maybe" },
				},
				{
					userId: "user-2",
					userName: "Bob",
					responses: { "2026-03-15": "not_available" },
				},
			]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.innerJoin = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getAvailabilityForEventDate("req-1", "2026-03-15");

			expect(result).toEqual([
				{ userId: "user-1", userName: "Alice", status: "available" },
				{ userId: "user-2", userName: "Bob", status: "not_available" },
			]);
		});

		it("returns no_response for users who did not respond to the date", async () => {
			const chain = chainMock(null);
			chain.orderBy = vi.fn().mockResolvedValue([
				{
					userId: "user-1",
					userName: "Alice",
					responses: { "2026-03-16": "available" }, // different date
				},
			]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.innerJoin = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getAvailabilityForEventDate("req-1", "2026-03-15");

			expect(result[0].status).toBe("no_response");
		});

		it("returns empty array when no responses exist", async () => {
			const chain = chainMock(null);
			chain.orderBy = vi.fn().mockResolvedValue([]);
			chain.where = vi.fn().mockReturnValue(chain);
			chain.innerJoin = vi.fn().mockReturnValue(chain);
			chain.from = vi.fn().mockReturnValue(chain);
			mockSelect.mockReturnValueOnce(chain);

			const result = await getAvailabilityForEventDate("req-1", "2026-03-15");

			expect(result).toEqual([]);
		});
	});
});
