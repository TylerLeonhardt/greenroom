import { beforeEach, describe, expect, it, vi } from "vitest";

// Create a chainable mock that returns a resolved value when awaited
function createChainableMock(resolvedValue: unknown[] = []) {
	const chain: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
		// biome-ignore lint/suspicious/noThenProperty: needed to make the mock awaitable for Promise.all
		then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
	};
	const methods = ["select", "from", "innerJoin", "leftJoin", "where", "orderBy", "limit"];
	for (const method of methods) {
		chain[method] = vi.fn().mockReturnValue(chain);
	}
	return chain;
}

let callIndex = 0;
let chains: ReturnType<typeof createChainableMock>[];

function resetChains(overrides?: Record<number, unknown[]>) {
	callIndex = 0;
	chains = [
		createChainableMock(overrides?.[0] ?? []), // userGroups
		createChainableMock(overrides?.[1] ?? []), // upcomingEvents
		createChainableMock(overrides?.[2] ?? []), // pendingRequests
		createChainableMock(overrides?.[3] ?? []), // pendingConfirmations
	];
}

const mockSelectFn = vi.fn().mockImplementation(() => chains[callIndex++]);

vi.mock("../../src/db/index.js", () => ({
	db: {
		select: mockSelectFn,
	},
}));

vi.mock("../../src/db/schema.js", () => ({
	availabilityRequests: {
		id: "id",
		groupId: "groupId",
		title: "title",
		status: "status",
		expiresAt: "expiresAt",
		dateRangeStart: "dateRangeStart",
		dateRangeEnd: "dateRangeEnd",
	},
	eventAssignments: { eventId: "eventId", userId: "userId", status: "status" },
	events: {
		id: "id",
		groupId: "groupId",
		title: "title",
		description: "description",
		eventType: "eventType",
		startTime: "startTime",
		endTime: "endTime",
		location: "location",
		createdById: "createdById",
		createdFromRequestId: "createdFromRequestId",
		createdAt: "createdAt",
		updatedAt: "updatedAt",
	},
	groupMemberships: { groupId: "groupId", userId: "userId", role: "role" },
	groups: {
		id: "id",
		name: "name",
		description: "description",
		inviteCode: "inviteCode",
		createdById: "createdById",
		createdAt: "createdAt",
		updatedAt: "updatedAt",
	},
}));

const mockFormatDateRange = vi.fn().mockReturnValue("Mar 1 – Mar 28, 2026");

vi.mock("../lib/date-utils.js", () => ({
	formatDateRange: mockFormatDateRange,
}));

const { getDashboardData } = await import("~/services/dashboard.server");

describe("getDashboardData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetChains();
	});

	it("returns structured data with all sections", async () => {
		const result = await getDashboardData("user-1");

		expect(mockSelectFn).toHaveBeenCalledTimes(4);
		expect(result).toEqual({
			groups: [],
			upcomingEvents: [],
			pendingRequests: [],
			pendingConfirmations: [],
		});
	});

	it("formats date ranges for pending requests", async () => {
		resetChains({
			2: [
				{
					id: "req-1",
					title: "March Availability",
					groupId: "group-1",
					groupName: "Cool Group",
					expiresAt: null,
					dateRangeStart: "2026-03-01",
					dateRangeEnd: "2026-03-28",
				},
				{
					id: "req-2",
					title: "April Availability",
					groupId: "group-1",
					groupName: "Cool Group",
					expiresAt: null,
					dateRangeStart: "2026-04-01",
					dateRangeEnd: "2026-04-30",
				},
			],
		});

		const result = await getDashboardData("user-1");

		expect(mockFormatDateRange).toHaveBeenCalledTimes(2);
		expect(mockFormatDateRange).toHaveBeenCalledWith("2026-03-01", "2026-03-28");
		expect(mockFormatDateRange).toHaveBeenCalledWith("2026-04-01", "2026-04-30");
		expect(result.pendingRequests).toHaveLength(2);
		expect(result.pendingRequests[0]).toEqual({
			id: "req-1",
			title: "March Availability",
			groupId: "group-1",
			groupName: "Cool Group",
			expiresAt: null,
			dateRange: "Mar 1 – Mar 28, 2026",
		});
	});

	it("passes userId to queries without throwing", async () => {
		await expect(getDashboardData("user-123")).resolves.toBeDefined();
		expect(mockSelectFn).toHaveBeenCalledTimes(4);
	});
});
