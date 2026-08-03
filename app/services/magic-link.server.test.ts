import { describe, expect, it } from "vitest";
import {
	generateMagicLinkToken,
	hashMagicLinkToken,
	issueLoginMagicLink,
	isValidMagicLinkToken,
	validateMagicLinkRedirectPath,
} from "./magic-link.server.js";

describe("magic-link service", () => {
	it("generates a 256-bit base64url token and hashes it as lowercase SHA-256 hex", () => {
		const rawToken = generateMagicLinkToken();
		const tokenHash = hashMagicLinkToken(rawToken);

		expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(isValidMagicLinkToken(rawToken)).toBe(true);
		expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
		expect(tokenHash).not.toContain(rawToken);
	});

	it.each([
		"//evil.example",
		"https://evil.example",
		"javascript:alert(1)",
		"\\evil.example",
		"/\\evil.example",
		"/https://evil.example",
		"/%2Fevil.example",
		"/%5Cevil.example",
		"/%0Devil.example",
		"/%252Fevil.example",
		"/%25252525252Fevil.example",
		"/%68ttps%3A%2F%2Fevil.example",
	])("rejects unsafe redirect %s", (redirectPath) => {
		expect(validateMagicLinkRedirectPath(redirectPath)).toBe("/dashboard");
	});

	it("accepts a strict local path", () => {
		expect(validateMagicLinkRedirectPath("/groups/123/events?view=calendar")).toBe(
			"/groups/123/events?view=calendar",
		);
	});

	it("rejects expiry windows longer than 15 minutes", async () => {
		await expect(issueLoginMagicLink({ userId: "user-1", expiryMinutes: 16 })).rejects.toThrow(
			"between 1 and 15 minutes",
		);
	});
});
