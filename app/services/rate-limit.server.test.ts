import { beforeEach, describe, expect, it } from "vitest";
import {
	_resetForTests,
	checkAvailabilityRequestCreateRateLimit,
	checkAvailabilityResponseRateLimit,
	checkEventCreateRateLimit,
	checkGroupCreateRateLimit,
	checkGroupJoinRateLimit,
	checkRateLimit,
} from "~/services/rate-limit.server";

describe("rate limiter", () => {
	beforeEach(() => {
		_resetForTests();
	});

	it("allows requests under the limit", () => {
		for (let i = 0; i < 5; i++) {
			const result = checkRateLimit("test-key", 5, 60000);
			expect(result.limited).toBe(false);
		}
	});

	it("blocks requests at the limit", () => {
		for (let i = 0; i < 5; i++) {
			checkRateLimit("test-key", 5, 60000);
		}
		const result = checkRateLimit("test-key", 5, 60000);
		expect(result.limited).toBe(true);
		if (result.limited) {
			expect(result.retryAfter).toBeGreaterThan(0);
		}
	});

	it("isolates different keys", () => {
		for (let i = 0; i < 5; i++) {
			checkRateLimit("key-a", 5, 60000);
		}

		// key-b should still be allowed
		const result = checkRateLimit("key-b", 5, 60000);
		expect(result.limited).toBe(false);

		// key-a should be blocked
		const resultA = checkRateLimit("key-a", 5, 60000);
		expect(resultA.limited).toBe(true);
	});

	it("allows requests after window expires", async () => {
		// Use a very short window (50ms)
		for (let i = 0; i < 3; i++) {
			checkRateLimit("expire-key", 3, 50);
		}

		const blockedResult = checkRateLimit("expire-key", 3, 50);
		expect(blockedResult.limited).toBe(true);

		// Wait for window to pass
		await new Promise((resolve) => setTimeout(resolve, 60));

		const allowedResult = checkRateLimit("expire-key", 3, 50);
		expect(allowedResult.limited).toBe(false);
	});
});

describe("per-user rate limit functions", () => {
	beforeEach(() => {
		_resetForTests();
	});

	it("checkGroupCreateRateLimit allows 50 requests then blocks", () => {
		const userId = "user-1";
		for (let i = 0; i < 50; i++) {
			expect(checkGroupCreateRateLimit(userId).limited).toBe(false);
		}
		const result = checkGroupCreateRateLimit(userId);
		expect(result.limited).toBe(true);
		if (result.limited) {
			expect(result.retryAfter).toBeGreaterThan(0);
		}
	});

	it("checkEventCreateRateLimit allows 200 requests then blocks", () => {
		const userId = "user-2";
		for (let i = 0; i < 200; i++) {
			expect(checkEventCreateRateLimit(userId).limited).toBe(false);
		}
		expect(checkEventCreateRateLimit(userId).limited).toBe(true);
	});

	it("checkAvailabilityRequestCreateRateLimit allows 100 requests then blocks", () => {
		const userId = "user-3";
		for (let i = 0; i < 100; i++) {
			expect(checkAvailabilityRequestCreateRateLimit(userId).limited).toBe(false);
		}
		expect(checkAvailabilityRequestCreateRateLimit(userId).limited).toBe(true);
	});

	it("checkAvailabilityResponseRateLimit allows 500 requests then blocks", () => {
		const userId = "user-4";
		for (let i = 0; i < 500; i++) {
			expect(checkAvailabilityResponseRateLimit(userId).limited).toBe(false);
		}
		expect(checkAvailabilityResponseRateLimit(userId).limited).toBe(true);
	});

	it("checkGroupJoinRateLimit allows 100 requests then blocks", () => {
		const userId = "user-5";
		for (let i = 0; i < 100; i++) {
			expect(checkGroupJoinRateLimit(userId).limited).toBe(false);
		}
		expect(checkGroupJoinRateLimit(userId).limited).toBe(true);
	});

	it("isolates rate limits between different users", () => {
		for (let i = 0; i < 50; i++) {
			checkGroupCreateRateLimit("user-a");
		}
		expect(checkGroupCreateRateLimit("user-a").limited).toBe(true);
		expect(checkGroupCreateRateLimit("user-b").limited).toBe(false);
	});

	it("isolates rate limits between different action types for the same user", () => {
		const userId = "user-x";
		for (let i = 0; i < 50; i++) {
			checkGroupCreateRateLimit(userId);
		}
		expect(checkGroupCreateRateLimit(userId).limited).toBe(true);
		// Same user should still be allowed for other actions
		expect(checkEventCreateRateLimit(userId).limited).toBe(false);
		expect(checkGroupJoinRateLimit(userId).limited).toBe(false);
	});

	it("returns a positive retryAfter value when blocked", () => {
		const userId = "user-retry";
		for (let i = 0; i < 50; i++) {
			checkGroupCreateRateLimit(userId);
		}
		const result = checkGroupCreateRateLimit(userId);
		expect(result.limited).toBe(true);
		if (result.limited) {
			expect(result.retryAfter).toBeGreaterThan(0);
			// 24-hour window → retryAfter should be ≤ 86400 seconds
			expect(result.retryAfter).toBeLessThanOrEqual(86400);
		}
	});
});
