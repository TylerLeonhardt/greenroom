import { beforeEach, describe, expect, it } from "vitest";
import { _resetForTests, checkRateLimit } from "~/services/rate-limit.server";

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
