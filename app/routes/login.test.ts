import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	authenticator: {
		authenticate: vi.fn(),
	},
	createUserSession: vi.fn(),
	getOptionalUser: vi.fn().mockResolvedValue(null),
	isEmailVerified: vi.fn().mockResolvedValue(true),
}));

// Mock rate limiting — allow all by default
vi.mock("~/services/rate-limit.server", () => ({
	checkLoginRateLimit: vi.fn().mockReturnValue({ limited: false }),
}));

import { action, loader } from "~/routes/login";
import {
	authenticator,
	createUserSession,
	getOptionalUser,
	isEmailVerified,
} from "~/services/auth.server";
import { checkLoginRateLimit } from "~/services/rate-limit.server";

describe("login route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(getOptionalUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(checkLoginRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
		(isEmailVerified as ReturnType<typeof vi.fn>).mockResolvedValue(true);
	});

	describe("loader", () => {
		it("returns verified false for unauthenticated users", async () => {
			const request = new Request("http://localhost/login");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({ verified: false });
		});

		it("returns verified true when query param present", async () => {
			const request = new Request("http://localhost/login?verified=true");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({ verified: true });
		});

		it("redirects to /dashboard if already logged in", async () => {
			(getOptionalUser as ReturnType<typeof vi.fn>).mockResolvedValue({
				id: "user-1",
				email: "test@example.com",
				name: "Test",
				profileImage: null,
			});

			const request = new Request("http://localhost/login");
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
		it("creates session and redirects on successful login with verified email", async () => {
			const user = { id: "user-1", email: "test@example.com", name: "Test", profileImage: null };
			(authenticator.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(user);
			(isEmailVerified as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			(createUserSession as ReturnType<typeof vi.fn>).mockResolvedValue(
				new Response(null, { status: 302, headers: { Location: "/dashboard" } }),
			);

			const formData = new FormData();
			formData.set("email", "test@example.com");
			formData.set("password", "password123");

			const request = new Request("http://localhost/login", {
				method: "POST",
				body: formData,
			});

			await action({ request, params: {}, context: {} });
			expect(authenticator.authenticate).toHaveBeenCalledWith("form", request);
			expect(createUserSession).toHaveBeenCalledWith("user-1", "/dashboard");
		});

		it("redirects to /check-email when email is not verified", async () => {
			const user = { id: "user-1", email: "test@example.com", name: "Test", profileImage: null };
			(authenticator.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(user);
			(isEmailVerified as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			(createUserSession as ReturnType<typeof vi.fn>).mockResolvedValue(
				new Response(null, { status: 302, headers: { Location: "/check-email" } }),
			);

			const formData = new FormData();
			formData.set("email", "test@example.com");
			formData.set("password", "password123");

			const request = new Request("http://localhost/login", {
				method: "POST",
				body: formData,
			});

			await action({ request, params: {}, context: {} });
			expect(createUserSession).toHaveBeenCalledWith("user-1", "/check-email");
		});

		it("returns error on invalid credentials", async () => {
			(authenticator.authenticate as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error("Invalid email or password."),
			);

			const formData = new FormData();
			formData.set("email", "test@example.com");
			formData.set("password", "wrongpassword");

			const request = new Request("http://localhost/login", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toEqual({ error: "Invalid email or password." });
		});

		it("returns 429 when rate limited", async () => {
			(checkLoginRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({
				limited: true,
				retryAfter: 30,
			});

			const formData = new FormData();
			formData.set("email", "test@example.com");
			formData.set("password", "password123");

			const request = new Request("http://localhost/login", {
				method: "POST",
				body: formData,
			});

			const result = await action({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(429);
			const data = await (result as Response).json();
			expect(data.error).toContain("Too many login attempts");
		});
	});
});
