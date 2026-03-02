import { beforeEach, describe, expect, it, vi } from "vitest";

// Create a chainable mock that returns a resolved value when awaited
function createChainableMock(resolvedValue: unknown[] = []) {
	const chain: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
		// biome-ignore lint/suspicious/noThenProperty: needed to make the mock awaitable for Promise.all
		then: (resolve: (v: unknown) => void) => resolve(resolvedValue),
	};
	const methods = ["select", "from", "where"];
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
		createChainableMock(overrides?.[0] ?? [{ totalUsers: 0 }]),
		createChainableMock(overrides?.[1] ?? [{ totalAvailabilityRequests: 0 }]),
		createChainableMock(overrides?.[2] ?? [{ totalEvents: 0 }]),
		createChainableMock(overrides?.[3] ?? [{ newUsers: 0 }]),
		createChainableMock(overrides?.[4] ?? [{ newAvailabilityRequests: 0 }]),
		createChainableMock(overrides?.[5] ?? [{ newEvents: 0 }]),
	];
}

const mockSelectFn = vi.fn().mockImplementation(() => chains[callIndex++]);

vi.mock("../../src/db/index.js", () => ({
	db: {
		select: mockSelectFn,
	},
}));

vi.mock("../../src/db/schema.js", () => ({
	users: {
		deletedAt: "deletedAt",
		createdAt: "createdAt",
	},
	availabilityRequests: {
		createdAt: "createdAt",
	},
	events: {
		createdAt: "createdAt",
	},
}));

const { getAnalytics } = await import("~/services/analytics.server");

describe("getAnalytics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetChains();
	});

	it("returns all six metrics with defaults", async () => {
		const result = await getAnalytics(30);

		expect(mockSelectFn).toHaveBeenCalledTimes(6);
		expect(result).toEqual({
			totalUsers: 0,
			totalAvailabilityRequests: 0,
			totalEvents: 0,
			newUsers: 0,
			newAvailabilityRequests: 0,
			newEvents: 0,
			windowDays: 30,
		});
	});

	it("returns populated metrics", async () => {
		resetChains({
			0: [{ totalUsers: 150 }],
			1: [{ totalAvailabilityRequests: 42 }],
			2: [{ totalEvents: 78 }],
			3: [{ newUsers: 12 }],
			4: [{ newAvailabilityRequests: 5 }],
			5: [{ newEvents: 8 }],
		});

		const result = await getAnalytics(7);

		expect(result).toEqual({
			totalUsers: 150,
			totalAvailabilityRequests: 42,
			totalEvents: 78,
			newUsers: 12,
			newAvailabilityRequests: 5,
			newEvents: 8,
			windowDays: 7,
		});
	});

	it("passes windowDays through to result", async () => {
		const result = await getAnalytics(90);
		expect(result.windowDays).toBe(90);
	});

	it("runs 6 parallel queries via Promise.all", async () => {
		await getAnalytics(30);
		expect(mockSelectFn).toHaveBeenCalledTimes(6);
	});
});
