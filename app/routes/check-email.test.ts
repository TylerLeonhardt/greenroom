import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	generateVerificationToken: vi.fn().mockResolvedValue("test-token-123"),
	getUserEmailById: vi.fn().mockResolvedValue("user@example.com"),
}));

// Mock email service
vi.mock("~/services/email.server", () => ({
	sendVerificationEmail: vi.fn(),
}));

// Mock rate limiting
vi.mock("~/services/rate-limit.server", () => ({
	checkResendVerificationRateLimit: vi.fn().mockReturnValue({ limited: false }),
}));

// Mock session service
vi.mock("~/services/session.server", () => ({
	getUserId: vi.fn().mockResolvedValue("user-1"),
	destroyUserSession: vi
		.fn()
		.mockReturnValue(new Response(null, { status: 302, headers: { Location: "/signup" } })),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action, loader } from "~/routes/check-email";
import { generateVerificationToken, getUserEmailById } from "~/services/auth.server";
import { sendVerificationEmail } from "~/services/email.server";
import { checkResendVerificationRateLimit } from "~/services/rate-limit.server";
import { destroyUserSession, getUserId } from "~/services/session.server";

describe("check-email route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(getUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
		(getUserEmailById as ReturnType<typeof vi.fn>).mockResolvedValue("user@example.com");
		(checkResendVerificationRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({
			limited: false,
		});
		(destroyUserSession as ReturnType<typeof vi.fn>).mockReturnValue(
			new Response(null, { status: 302, headers: { Location: "/signup" } }),
		);
	});

	describe("loader", () => {
		it("returns email for authenticated user", async () => {
			const request = new Request("http://localhost/check-email");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({ email: "user@example.com" });
		});

		it("redirects to /login if not authenticated", async () => {
			(getUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
			const request = new Request("http://localhost/check-email");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(302);
			expect((result as Response).headers.get("Location")).toBe("/login");
		});

		it("redirects to /login if user email not found", async () => {
			(getUserEmailById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
			const request = new Request("http://localhost/check-email");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(302);
			expect((result as Response).headers.get("Location")).toBe("/login");
		});
	});

	describe("action", () => {
		it("resends verification email on default POST", async () => {
			const formData = new FormData();
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toEqual({ success: true });
			expect(generateVerificationToken).toHaveBeenCalledWith("user-1");
			expect(sendVerificationEmail).toHaveBeenCalledWith({
				email: "user@example.com",
				name: "there",
				verificationUrl: "http://localhost:5173/verify-email?token=test-token-123",
			});
		});

		it("destroys session and redirects to /signup on change-email intent", async () => {
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: new URLSearchParams({ intent: "change-email" }),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			});

			const result = await action({ request, params: {}, context: {} });
			expect(destroyUserSession).toHaveBeenCalled();
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(302);
			expect((result as Response).headers.get("Location")).toBe("/signup");
			expect(sendVerificationEmail).not.toHaveBeenCalled();
			expect(generateVerificationToken).not.toHaveBeenCalled();
		});

		it("returns rate limit error when too many resend attempts", async () => {
			(checkResendVerificationRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({
				limited: true,
				retryAfter: 30,
			});

			const formData = new FormData();
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toHaveProperty("error");
			expect((result as { error: string }).error).toContain("Please wait 30 seconds");
		});

		it("redirects to /login if not authenticated on resend", async () => {
			(getUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
			const formData = new FormData();
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(302);
			expect((result as Response).headers.get("Location")).toBe("/login");
		});
	});
});
