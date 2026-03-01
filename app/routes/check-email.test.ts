import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	generateVerificationToken: vi.fn().mockResolvedValue("test-token-123"),
	getUserByEmail: vi.fn(),
}));

// Mock email service
vi.mock("~/services/email.server", () => ({
	sendVerificationEmail: vi.fn(),
}));

// Mock rate limiting
vi.mock("~/services/rate-limit.server", () => ({
	checkResendVerificationRateLimit: vi.fn().mockReturnValue({ limited: false }),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action, loader } from "~/routes/check-email";
import { generateVerificationToken, getUserByEmail } from "~/services/auth.server";
import { sendVerificationEmail } from "~/services/email.server";
import { checkResendVerificationRateLimit } from "~/services/rate-limit.server";

describe("check-email route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "Test User",
			emailVerified: false,
		});
		(checkResendVerificationRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({
			limited: false,
		});
	});

	describe("loader", () => {
		it("returns email from query param", async () => {
			const request = new Request("http://localhost/check-email?email=user@example.com");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({ email: "user@example.com" });
		});

		it("returns null email when no query param", async () => {
			const request = new Request("http://localhost/check-email");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({ email: null });
		});
	});

	describe("action", () => {
		it("resends verification email for unverified user", async () => {
			const formData = new FormData();
			formData.set("email", "user@example.com");
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toEqual({ success: true });
			expect(getUserByEmail).toHaveBeenCalledWith("user@example.com");
			expect(generateVerificationToken).toHaveBeenCalledWith("user-1");
			expect(sendVerificationEmail).toHaveBeenCalledWith({
				email: "user@example.com",
				name: "Test User",
				verificationUrl: "http://localhost:5173/verify-email?token=test-token-123",
			});
		});

		it("returns success without sending email for already verified user (prevents enumeration)", async () => {
			(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
				id: "user-1",
				email: "user@example.com",
				name: "Test User",
				emailVerified: true,
			});

			const formData = new FormData();
			formData.set("email", "user@example.com");
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toEqual({ success: true });
			expect(sendVerificationEmail).not.toHaveBeenCalled();
			expect(generateVerificationToken).not.toHaveBeenCalled();
		});

		it("returns success without sending email for unknown email (prevents enumeration)", async () => {
			(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			const formData = new FormData();
			formData.set("email", "unknown@example.com");
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toEqual({ success: true });
			expect(sendVerificationEmail).not.toHaveBeenCalled();
			expect(generateVerificationToken).not.toHaveBeenCalled();
		});

		it("redirects to /signup on change-email intent", async () => {
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: new URLSearchParams({ intent: "change-email" }),
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			});

			const result = await action({ request, params: {}, context: {} });
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
			formData.set("email", "user@example.com");
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toHaveProperty("error");
			expect((result as { error: string }).error).toContain("Please wait 30 seconds");
		});

		it("redirects to /signup when no email provided", async () => {
			const formData = new FormData();
			const request = new Request("http://localhost/check-email", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(302);
			expect((result as Response).headers.get("Location")).toBe("/signup");
		});
	});
});
