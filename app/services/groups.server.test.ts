import { describe, expect, it } from "vitest";
import { generateInviteCode } from "~/services/groups.server";

const VALID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("generateInviteCode", () => {
	it("returns an 8-character string", () => {
		const code = generateInviteCode();
		expect(code).toHaveLength(8);
	});

	it("only contains allowed characters (no I, O, 0, 1)", () => {
		// Run multiple times to increase confidence
		for (let i = 0; i < 100; i++) {
			const code = generateInviteCode();
			for (const char of code) {
				expect(VALID_CHARS).toContain(char);
			}
		}
	});

	it("does not contain ambiguous characters", () => {
		const ambiguous = ["I", "O", "0", "1"];
		for (let i = 0; i < 100; i++) {
			const code = generateInviteCode();
			for (const char of ambiguous) {
				expect(code).not.toContain(char);
			}
		}
	});

	it("generates different codes on subsequent calls", () => {
		const codes = new Set<string>();
		for (let i = 0; i < 50; i++) {
			codes.add(generateInviteCode());
		}
		// With 28^8 possible codes, 50 should all be unique
		expect(codes.size).toBe(50);
	});

	it("returns uppercase characters only", () => {
		for (let i = 0; i < 50; i++) {
			const code = generateInviteCode();
			expect(code).toBe(code.toUpperCase());
		}
	});
});
