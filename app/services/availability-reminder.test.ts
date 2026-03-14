import { beforeEach, describe, expect, it, vi } from "vitest";

// Chain mock that resolves at .where() (for queries without .limit())
function createChainMock(resolvedValue: unknown) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.where = vi.fn().mockResolvedValue(resolvedValue);
	chain.innerJoin = vi.fn().mockReturnValue(chain);
	chain.from = vi.fn().mockReturnValue(chain);
	return chain;
}

// Chain mock that resolves at .limit() (for queries with .limit(1))
function createChainWithLimit(resolvedValue: unknown) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.limit = vi.fn().mockResolvedValue(resolvedValue);
	chain.where = vi.fn().mockReturnValue(chain);
	chain.from = vi.fn().mockReturnValue(chain);
	return chain;
}

// Mock db BEFORE imports — vi.mock is hoisted so inline the mock object
vi.mock("../../src/db/index.js", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn(),
				onConflictDoUpdate: vi.fn(),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({ where: vi.fn() }),
		}),
		delete: vi.fn().mockReturnValue({ where: vi.fn() }),
		transaction: vi.fn(),
	},
}));

vi.mock("./telemetry.server.js", () => ({
	trackEvent: vi.fn(),
}));

import { db } from "../../src/db/index.js";
import { getNonRespondents } from "./availability.server";

describe("getNonRespondents", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function setupMocks(
		requestRow: Array<{ groupId: string }>,
		allMembers: Array<{
			userId: string;
			name: string;
			email: string;
			notificationPreferences: unknown;
		}>,
		respondedUsers: Array<{ userId: string }>,
	) {
		// 3 calls: verify request (with .limit()), get members (with .where()), get responses (with .where())
		const requestChain = createChainWithLimit(requestRow);
		const membersChain = createChainMock(allMembers);
		const responsesChain = createChainMock(respondedUsers);

		let callIndex = 0;
		vi.mocked(db.select).mockImplementation(() => {
			const chains = [requestChain, membersChain, responsesChain];
			const chain = chains[callIndex];
			callIndex++;
			return chain as never;
		});
	}

	it("returns members who haven't responded", async () => {
		setupMocks(
			[{ groupId: "g1" }],
			[
				{ userId: "u1", name: "Alice", email: "alice@test.com", notificationPreferences: null },
				{ userId: "u2", name: "Bob", email: "bob@test.com", notificationPreferences: null },
				{ userId: "u3", name: "Carol", email: "carol@test.com", notificationPreferences: null },
			],
			[{ userId: "u1" }],
		);

		const result = await getNonRespondents("r1", "g1");

		expect(result).toHaveLength(2);
		expect(result.map((r) => r.name)).toEqual(["Bob", "Carol"]);
	});

	it("returns empty array when everyone has responded", async () => {
		setupMocks(
			[{ groupId: "g1" }],
			[
				{ userId: "u1", name: "Alice", email: "alice@test.com", notificationPreferences: null },
				{ userId: "u2", name: "Bob", email: "bob@test.com", notificationPreferences: null },
			],
			[{ userId: "u1" }, { userId: "u2" }],
		);

		const result = await getNonRespondents("r1", "g1");

		expect(result).toHaveLength(0);
	});

	it("returns all members when no one has responded", async () => {
		setupMocks(
			[{ groupId: "g1" }],
			[
				{ userId: "u1", name: "Alice", email: "alice@test.com", notificationPreferences: null },
				{ userId: "u2", name: "Bob", email: "bob@test.com", notificationPreferences: null },
				{ userId: "u3", name: "Carol", email: "carol@test.com", notificationPreferences: null },
			],
			[],
		);

		const result = await getNonRespondents("r1", "g1");

		expect(result).toHaveLength(3);
		expect(result.map((r) => r.name)).toEqual(["Alice", "Bob", "Carol"]);
	});

	it("includes notification preferences in the result", async () => {
		const prefs = {
			availabilityRequests: { email: true },
			eventNotifications: { email: false },
			showReminders: { email: true },
		};
		setupMocks(
			[{ groupId: "g1" }],
			[{ userId: "u1", name: "Alice", email: "alice@test.com", notificationPreferences: prefs }],
			[],
		);

		const result = await getNonRespondents("r1", "g1");

		expect(result).toHaveLength(1);
		expect(result[0].notificationPreferences).toEqual(prefs);
	});

	it("returns empty array when request belongs to a different group", async () => {
		// Request belongs to group "g2" but we pass "g1"
		const requestChain = createChainWithLimit([{ groupId: "g2" }]);
		vi.mocked(db.select).mockImplementation(() => requestChain as never);

		const result = await getNonRespondents("r1", "g1");

		expect(result).toHaveLength(0);
		// Should only make 1 DB call (the verification) and bail early
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("returns empty array when request does not exist", async () => {
		const requestChain = createChainWithLimit([]);
		vi.mocked(db.select).mockImplementation(() => requestChain as never);

		const result = await getNonRespondents("nonexistent", "g1");

		expect(result).toHaveLength(0);
		expect(db.select).toHaveBeenCalledTimes(1);
	});
});
