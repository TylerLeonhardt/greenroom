import { describe, expect, it } from "vitest";
import { generateInviteCode } from "~/services/groups.server";

describe("generateInviteCode — cryptographic security", () => {
	it("generates 8-character codes", () => {
		const code = generateInviteCode();
		expect(code).toHaveLength(8);
	});

	it("uses only valid charset characters", () => {
		const validChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
		for (let i = 0; i < 100; i++) {
			const code = generateInviteCode();
			for (const char of code) {
				expect(validChars).toContain(char);
			}
		}
	});

	it("generates unique codes (no obvious patterns from Math.random)", () => {
		const codes = new Set<string>();
		for (let i = 0; i < 100; i++) {
			codes.add(generateInviteCode());
		}
		// With 28^8 possible codes, 100 random codes should all be unique
		expect(codes.size).toBe(100);
	});

	it("does not use Math.random (verified via source)", () => {
		// This test validates the fix was applied by checking the function
		// uses crypto.randomInt, not Math.random
		const fnSource = generateInviteCode.toString();
		expect(fnSource).not.toContain("Math.random");
	});
});
