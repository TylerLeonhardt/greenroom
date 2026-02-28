import { describe, expect, it } from "vitest";
import { generateCsrfToken, validateCsrfToken } from "~/services/csrf.server";
import { sessionStorage } from "~/services/session.server";

function createRequest(cookie?: string): Request {
	return new Request("http://localhost:5173/test", {
		headers: cookie ? { Cookie: cookie } : {},
	});
}

describe("CSRF token protection", () => {
	describe("generateCsrfToken", () => {
		it("generates a token and returns a session cookie", async () => {
			const request = createRequest();
			const { token, cookie } = await generateCsrfToken(request);

			expect(token).toBeTruthy();
			expect(typeof token).toBe("string");
			expect(token.length).toBe(64); // 32 bytes hex-encoded
			expect(cookie).toBeTruthy();
		});

		it("returns the same token for the same session", async () => {
			const request1 = createRequest();
			const { token: token1, cookie } = await generateCsrfToken(request1);

			const request2 = createRequest(cookie);
			const { token: token2 } = await generateCsrfToken(request2);

			expect(token1).toBe(token2);
		});

		it("generates different tokens for different sessions", async () => {
			const { token: token1 } = await generateCsrfToken(createRequest());
			const { token: token2 } = await generateCsrfToken(createRequest());

			expect(token1).not.toBe(token2);
		});
	});

	describe("validateCsrfToken", () => {
		it("passes when form token matches session token", async () => {
			const request = createRequest();
			const { token, cookie } = await generateCsrfToken(request);

			const formData = new FormData();
			formData.set("_csrf", token);

			const validationRequest = createRequest(cookie);
			await expect(validateCsrfToken(validationRequest, formData)).resolves.toBeUndefined();
		});

		it("throws 403 when form token is missing", async () => {
			const request = createRequest();
			const { cookie } = await generateCsrfToken(request);

			const formData = new FormData();
			const validationRequest = createRequest(cookie);

			try {
				await validateCsrfToken(validationRequest, formData);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(403);
			}
		});

		it("throws 403 when form token does not match session token", async () => {
			const request = createRequest();
			const { cookie } = await generateCsrfToken(request);

			const formData = new FormData();
			formData.set("_csrf", "wrong-token");

			const validationRequest = createRequest(cookie);

			try {
				await validateCsrfToken(validationRequest, formData);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(403);
			}
		});

		it("throws 403 when session has no token", async () => {
			const session = await sessionStorage.getSession();
			const cookie = await sessionStorage.commitSession(session);

			const formData = new FormData();
			formData.set("_csrf", "some-token");

			const request = createRequest(cookie);

			try {
				await validateCsrfToken(request, formData);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(403);
			}
		});

		it("throws 403 when both token and session are empty", async () => {
			const formData = new FormData();
			const request = createRequest();

			try {
				await validateCsrfToken(request, formData);
				expect.fail("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				expect((error as Response).status).toBe(403);
			}
		});
	});
});
