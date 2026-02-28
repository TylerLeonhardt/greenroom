import { describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	verifyEmailToken: vi.fn(),
}));

import { loader } from "~/routes/verify-email";
import { verifyEmailToken } from "~/services/auth.server";

describe("verify-email route", () => {
	describe("loader", () => {
		it("returns error when no token provided", async () => {
			const request = new Request("http://localhost/verify-email");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({ error: "Invalid verification link." });
		});

		it("redirects to login with verified=true on valid token", async () => {
			(verifyEmailToken as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: true,
				userId: "user-1",
			});

			const request = new Request("http://localhost/verify-email?token=valid-token");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toBeInstanceOf(Response);
			expect((result as Response).status).toBe(302);
			expect((result as Response).headers.get("Location")).toBe("/login?verified=true");
		});

		it("returns error on expired token", async () => {
			(verifyEmailToken as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: false,
				reason: "This verification link has expired.",
			});

			const request = new Request("http://localhost/verify-email?token=expired-token");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({ error: "This verification link has expired." });
		});

		it("returns error on invalid token", async () => {
			(verifyEmailToken as ReturnType<typeof vi.fn>).mockResolvedValue({
				success: false,
				reason: "Invalid verification link.",
			});

			const request = new Request("http://localhost/verify-email?token=bad-token");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({ error: "Invalid verification link." });
		});
	});
});
