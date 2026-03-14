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

const { createEventsFromAvailability } = await import("~/services/events.server");

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
	timezone: "America/Los_Angeles",
	reminderSentAt: null,
	confirmationReminderSentAt: null,
	createdAt: now,
	updatedAt: now,
};

// --- Tests ---

describe("batch events — createEventsFromAvailability per-date features", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses per-date location when provided", async () => {
		mockReturning
			.mockResolvedValueOnce([{ ...mockEvent, id: "ev-1", location: "Theater A" }])
			.mockResolvedValueOnce([{ ...mockEvent, id: "ev-2", location: "Theater B" }]);

		const result = await createEventsFromAvailability({
			groupId: "group-1",
			requestId: "req-1",
			dates: [
				{ date: "2026-03-15", startTime: "19:00", endTime: "21:00", location: "Theater A" },
				{ date: "2026-03-16", startTime: "18:00", endTime: "20:00", location: "Theater B" },
			],
			title: "Show Night",
			eventType: "show",
			location: "Default Venue",
			createdById: "user-1",
		});

		expect(result).toHaveLength(2);
		// First event should use per-date location "Theater A"
		expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ location: "Theater A" }));
	});

	it("falls back to shared location when per-date location is missing", async () => {
		mockReturning.mockResolvedValueOnce([{ ...mockEvent, id: "ev-1", location: "Default Venue" }]);

		await createEventsFromAvailability({
			groupId: "group-1",
			requestId: "req-1",
			dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
			title: "Rehearsal",
			eventType: "rehearsal",
			location: "Default Venue",
			createdById: "user-1",
		});

		// Per-date location is undefined, so falls back to shared "Default Venue"
		expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ location: "Default Venue" }));
	});

	it("passes description to each created event", async () => {
		mockReturning
			.mockResolvedValueOnce([{ ...mockEvent, id: "ev-1", description: "Weekly practice" }])
			.mockResolvedValueOnce([{ ...mockEvent, id: "ev-2", description: "Weekly practice" }]);

		await createEventsFromAvailability({
			groupId: "group-1",
			requestId: "req-1",
			dates: [
				{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" },
				{ date: "2026-03-16", startTime: "19:00", endTime: "21:00" },
			],
			title: "Rehearsal",
			description: "Weekly practice",
			eventType: "rehearsal",
			createdById: "user-1",
		});

		// Both events should have the description
		const calls = mockValues.mock.calls;
		expect(calls[0][0]).toEqual(expect.objectContaining({ description: "Weekly practice" }));
		expect(calls[1][0]).toEqual(expect.objectContaining({ description: "Weekly practice" }));
	});

	it("defaults description to null when not provided", async () => {
		mockReturning.mockResolvedValueOnce([mockEvent]);

		await createEventsFromAvailability({
			groupId: "group-1",
			requestId: "req-1",
			dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
			title: "Rehearsal",
			eventType: "rehearsal",
			createdById: "user-1",
		});

		expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
	});

	it("mixes per-date and fallback locations across dates", async () => {
		mockReturning
			.mockResolvedValueOnce([{ ...mockEvent, id: "ev-1", location: "Custom Spot" }])
			.mockResolvedValueOnce([{ ...mockEvent, id: "ev-2", location: "Shared Venue" }]);

		await createEventsFromAvailability({
			groupId: "group-1",
			requestId: "req-1",
			dates: [
				{ date: "2026-03-15", startTime: "19:00", endTime: "21:00", location: "Custom Spot" },
				{ date: "2026-03-16", startTime: "19:00", endTime: "21:00" },
			],
			title: "Rehearsal",
			eventType: "rehearsal",
			location: "Shared Venue",
			createdById: "user-1",
		});

		const calls = mockValues.mock.calls;
		// First call: per-date location "Custom Spot"
		expect(calls[0][0]).toEqual(expect.objectContaining({ location: "Custom Spot" }));
		// Second call: fallback to "Shared Venue"
		expect(calls[1][0]).toEqual(expect.objectContaining({ location: "Shared Venue" }));
	});

	it("location is null when neither per-date nor shared location is provided", async () => {
		mockReturning.mockResolvedValueOnce([{ ...mockEvent, location: null }]);

		await createEventsFromAvailability({
			groupId: "group-1",
			requestId: "req-1",
			dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
			title: "Rehearsal",
			eventType: "rehearsal",
			createdById: "user-1",
		});

		expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
	});

	it("passes callTime to each created event when provided", async () => {
		mockReturning
			.mockResolvedValueOnce([
				{ ...mockEvent, id: "ev-1", callTime: new Date("2026-03-15T18:00:00Z") },
			])
			.mockResolvedValueOnce([
				{ ...mockEvent, id: "ev-2", callTime: new Date("2026-03-16T18:00:00Z") },
			]);

		await createEventsFromAvailability({
			groupId: "group-1",
			requestId: "req-1",
			dates: [
				{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" },
				{ date: "2026-03-16", startTime: "19:00", endTime: "21:00" },
			],
			title: "Big Show",
			eventType: "show",
			createdById: "user-1",
			callTime: "18:00",
		});

		const calls = mockValues.mock.calls;
		// Each event should have callTime converted via localTimeToUTC
		expect(calls[0][0]).toEqual(
			expect.objectContaining({ callTime: new Date("2026-03-15T18:00:00Z") }),
		);
		expect(calls[1][0]).toEqual(
			expect.objectContaining({ callTime: new Date("2026-03-16T18:00:00Z") }),
		);
	});

	it("defaults callTime to null when not provided", async () => {
		mockReturning.mockResolvedValueOnce([mockEvent]);

		await createEventsFromAvailability({
			groupId: "group-1",
			requestId: "req-1",
			dates: [{ date: "2026-03-15", startTime: "19:00", endTime: "21:00" }],
			title: "Rehearsal",
			eventType: "rehearsal",
			createdById: "user-1",
		});

		expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ callTime: null }));
	});
});
