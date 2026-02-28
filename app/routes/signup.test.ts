import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	getOptionalUser: vi.fn().mockResolvedValue(null),
	registerUser: vi.fn(),
	generateVerificationToken: vi.fn().mockResolvedValue("test-token-123"),
}));

// Mock email service
vi.mock("~/services/email.server", () => ({
	sendVerificationEmail: vi.fn(),
}));

// Mock rate limiting
vi.mock("~/services/rate-limit.server", () => ({
	checkSignupRateLimit: vi.fn().mockReturnValue({ limited: false }),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action, loader } from "~/routes/signup";
import { generateVerificationToken, getOptionalUser, registerUser } from "~/services/auth.server";
import { sendVerificationEmail } from "~/services/email.server";
import { checkSignupRateLimit } from "~/services/rate-limit.server";

describe("signup route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(getOptionalUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(checkSignupRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
	});

	describe("loader", () => {
		it("returns null for unauthenticated users", async () => {
			const request = new Request("http://localhost/signup");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toBeNull();
		});

		it("redirects to /dashboard if already logged in", async () => {
			(getOptionalUser as ReturnType<typeof vi.fn>).mockResolvedValue({
				id: "user-1",
				email: "test@example.com",
				name: "Test",
				profileImage: null,
			});

			const request = new Request("http://localhost/signup");
			try {
				await loader({ request, params: {}, context: {} });
				expect.fail("Should have thrown a redirect");
			} catch (response) {
				expect(response).toBeInstanceOf(Response);
				expect((response as Response).status).toBe(302);
				expect((response as Response).headers.get("Location")).toBe("/dashboard");
			}
		});
	});

	describe("action", () => {
		it("creates user, generates token, sends verification email, and redirects to check-email", async () => {
			const user = {
				id: "new-user",
				email: "new@example.com",
				name: "New User",
				profileImage: null,
			};
			(registerUser as ReturnType<typeof vi.fn>).mockResolvedValue({ user, isNew: true });

			const formData = new FormData();
			formData.set("name", "New User");
			formData.set("email", "new@example.com");
			formData.set("password", "securepassword");
			formData.set("confirmPassword", "securepassword");

			const request = new Request("http://localhost/signup", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(302);
			expect((result as Response).headers.get("Location")).toBe(
				"/check-email?email=new%40example.com",
			);
			expect(registerUser).toHaveBeenCalledWith("new@example.com", "securepassword", "New User");
			expect(generateVerificationToken).toHaveBeenCalledWith("new-user");
			expect(sendVerificationEmail).toHaveBeenCalledWith({
				email: "new@example.com",
				name: "New User",
				verificationUrl: "http://localhost:5173/verify-email?token=test-token-123",
			});
		});

		it("redirects to check-email for duplicate email (prevents enumeration)", async () => {
			const existingUser = {
				id: "existing-user",
				email: "existing@example.com",
				name: "Existing User",
				profileImage: null,
			};
			(registerUser as ReturnType<typeof vi.fn>).mockResolvedValue({
				user: existingUser,
				isNew: false,
			});

			const formData = new FormData();
			formData.set("name", "Dupe User");
			formData.set("email", "existing@example.com");
			formData.set("password", "securepassword");
			formData.set("confirmPassword", "securepassword");

			const request = new Request("http://localhost/signup", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(302);
			expect((result as Response).headers.get("Location")).toBe(
				"/check-email?email=existing%40example.com",
			);
			// Should NOT send a verification email for existing accounts
			expect(sendVerificationEmail).not.toHaveBeenCalled();
		});

		it("returns error when passwords do not match", async () => {
			const formData = new FormData();
			formData.set("name", "Test User");
			formData.set("email", "test@example.com");
			formData.set("password", "password123");
			formData.set("confirmPassword", "different456");

			const request = new Request("http://localhost/signup", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toHaveProperty("errors");
			expect((result as { errors: Record<string, string> }).errors.confirmPassword).toBe(
				"Passwords do not match.",
			);
		});

		it("returns error for missing name", async () => {
			const formData = new FormData();
			formData.set("name", "");
			formData.set("email", "test@example.com");
			formData.set("password", "password123");
			formData.set("confirmPassword", "password123");

			const request = new Request("http://localhost/signup", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toHaveProperty("errors");
			expect((result as { errors: Record<string, string> }).errors.name).toBe("Name is required.");
		});

		it("returns error for short password", async () => {
			const formData = new FormData();
			formData.set("name", "Test User");
			formData.set("email", "test@example.com");
			formData.set("password", "short");
			formData.set("confirmPassword", "short");

			const request = new Request("http://localhost/signup", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toHaveProperty("errors");
			expect((result as { errors: Record<string, string> }).errors.password).toBe(
				"Password must be at least 8 characters.",
			);
		});

		it("returns 429 when rate limited", async () => {
			(checkSignupRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({
				limited: true,
				retryAfter: 45,
			});

			const formData = new FormData();
			formData.set("name", "Test");
			formData.set("email", "test@example.com");
			formData.set("password", "password123");
			formData.set("confirmPassword", "password123");

			const request = new Request("http://localhost/signup", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(429);
			const data = await (result as Response).json();
			expect(data.errors.form).toContain("Too many signup attempts");
		});

		it("returns error when name exceeds 100 characters", async () => {
			const formData = new FormData();
			formData.set("name", "A".repeat(101));
			formData.set("email", "test@example.com");
			formData.set("password", "password123");
			formData.set("confirmPassword", "password123");

			const request = new Request("http://localhost/signup", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toHaveProperty("errors");
			expect((result as { errors: Record<string, string> }).errors.name).toBe(
				"Name must be 100 characters or less.",
			);
		});

		it("returns error when password exceeds 128 characters", async () => {
			const formData = new FormData();
			formData.set("name", "Test");
			formData.set("email", "test@example.com");
			formData.set("password", "A".repeat(129));
			formData.set("confirmPassword", "A".repeat(129));

			const request = new Request("http://localhost/signup", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toHaveProperty("errors");
			expect((result as { errors: Record<string, string> }).errors.password).toBe(
				"Password must be 128 characters or less.",
			);
		});
	});
});
