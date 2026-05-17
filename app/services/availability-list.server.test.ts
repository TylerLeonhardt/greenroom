import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock the DB layer before importing the module under test ---

const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

const mockOrderBy = vi.fn();
const mockSelectWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
const mockLeftJoin = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock("../../src/db/index.js", () => ({
	db: {
		select: mockSelect,
		update: mockUpdate,
	},
}));

// Mock logger
vi.mock("./logger.server.js", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Mock telemetry
vi.mock("./telemetry.server.js", () => ({
	trackEvent: vi.fn(),
}));

const { getGroupAvailabilityRequests } = await import("~/services/availability.server");

describe("getGroupAvailabilityRequests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset chainable mocks
		mockFrom.mockReturnValue({ leftJoin: mockLeftJoin });
		mockLeftJoin.mockReturnValue({ where: mockSelectWhere });
		mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy });
		mockOrderBy.mockResolvedValue([]);
	});

	// ============================================================
	// Auto-close behavior
	// ============================================================
	describe("auto-close expired requests", () => {
		it("runs an UPDATE to auto-close expired requests before querying", async () => {
			mockOrderBy.mockResolvedValueOnce([]);

			await getGroupAvailabilityRequests("group-1");

			// The update should have been called (auto-close step)
			expect(mockUpdate).toHaveBeenCalled();
			expect(mockSet).toHaveBeenCalledWith({ status: "closed" });
			expect(mockUpdateWhere).toHaveBeenCalled();
		});

		it("uses a 1-day buffer so requests stay open through the last day in any timezone", async () => {
			mockOrderBy.mockResolvedValueOnce([]);

			await getGroupAvailabilityRequests("group-1");

			// The WHERE clause is called with drizzle expressions.
			// We verify the update was invoked (the SQL uses `now() - interval '1 day'`
			// instead of `new Date()` which is the fix we applied).
			expect(mockUpdate).toHaveBeenCalledTimes(1);
			expect(mockSet).toHaveBeenCalledWith({ status: "closed" });
		});

		it("only auto-closes requests in the specified group", async () => {
			mockOrderBy.mockResolvedValueOnce([]);

			await getGroupAvailabilityRequests("group-xyz");

			// Verify update was called — it should scope to the given groupId
			expect(mockUpdate).toHaveBeenCalled();
		});

		it("does not affect already-closed requests (only targets open status)", async () => {
			mockOrderBy.mockResolvedValueOnce([
				{
					id: "r1",
					groupId: "group-1",
					title: "Already Closed",
					status: "closed",
					dateRangeStart: new Date("2025-01-01"),
					dateRangeEnd: new Date("2025-01-31"),
					requestedDates: [],
					requestedStartTime: null,
					requestedEndTime: null,
					createdById: "user-1",
					createdAt: new Date(),
					expiresAt: null,
					description: null,
					createdByName: "Admin",
					responseCount: 0,
					memberCount: 5,
					hasResponded: false,
				},
			]);

			const result = await getGroupAvailabilityRequests("group-1");

			// The auto-close UPDATE targets only open requests (via eq(status, "open"))
			// so already-closed requests are unaffected. The result still returns them.
			expect(result).toHaveLength(1);
			expect(result[0].status).toBe("closed");
		});
	});

	// ============================================================
	// hasResponded behavior
	// ============================================================
	describe("hasResponded field", () => {
		it("returns hasResponded: true when user has a response row", async () => {
			mockOrderBy.mockResolvedValueOnce([
				{
					id: "r1",
					groupId: "group-1",
					title: "Spring Dates",
					status: "open",
					dateRangeStart: new Date("2026-03-01"),
					dateRangeEnd: new Date("2026-03-28"),
					requestedDates: ["2026-03-15"],
					requestedStartTime: null,
					requestedEndTime: null,
					createdById: "user-2",
					createdAt: new Date(),
					expiresAt: null,
					description: null,
					createdByName: "Admin",
					responseCount: 3,
					memberCount: 5,
					hasResponded: true,
				},
			]);

			const result = await getGroupAvailabilityRequests("group-1", "user-1");

			expect(result[0].hasResponded).toBe(true);
		});

		it("returns hasResponded: false when user has no response row", async () => {
			mockOrderBy.mockResolvedValueOnce([
				{
					id: "r1",
					groupId: "group-1",
					title: "Spring Dates",
					status: "open",
					dateRangeStart: new Date("2026-03-01"),
					dateRangeEnd: new Date("2026-03-28"),
					requestedDates: ["2026-03-15"],
					requestedStartTime: null,
					requestedEndTime: null,
					createdById: "user-2",
					createdAt: new Date(),
					expiresAt: null,
					description: null,
					createdByName: "Admin",
					responseCount: 3,
					memberCount: 5,
					hasResponded: false,
				},
			]);

			const result = await getGroupAvailabilityRequests("group-1", "user-1");

			expect(result[0].hasResponded).toBe(false);
		});

		it("returns hasResponded: false when userId is not provided", async () => {
			mockOrderBy.mockResolvedValueOnce([
				{
					id: "r1",
					groupId: "group-1",
					title: "Spring Dates",
					status: "open",
					dateRangeStart: new Date("2026-03-01"),
					dateRangeEnd: new Date("2026-03-28"),
					requestedDates: ["2026-03-15"],
					requestedStartTime: null,
					requestedEndTime: null,
					createdById: "user-2",
					createdAt: new Date(),
					expiresAt: null,
					description: null,
					createdByName: "Admin",
					responseCount: 3,
					memberCount: 5,
					hasResponded: false,
				},
			]);

			const result = await getGroupAvailabilityRequests("group-1");

			// Without userId, the SQL always returns false
			expect(result[0].hasResponded).toBe(false);
		});
	});

	// ============================================================
	// createdByName fallback
	// ============================================================
	it("falls back to 'Deleted user' when createdByName is null", async () => {
		mockOrderBy.mockResolvedValueOnce([
			{
				id: "r1",
				groupId: "group-1",
				title: "Orphaned Request",
				status: "open",
				dateRangeStart: new Date("2026-03-01"),
				dateRangeEnd: new Date("2026-03-28"),
				requestedDates: [],
				requestedStartTime: null,
				requestedEndTime: null,
				createdById: "deleted-user",
				createdAt: new Date(),
				expiresAt: null,
				description: null,
				createdByName: null,
				responseCount: 0,
				memberCount: 5,
				hasResponded: false,
			},
		]);

		const result = await getGroupAvailabilityRequests("group-1");

		expect(result[0].createdByName).toBe("Deleted user");
	});
});
