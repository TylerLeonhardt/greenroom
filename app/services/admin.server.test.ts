import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.fn();

vi.mock("./auth.server.js", () => ({
	requireUser: mockRequireUser,
}));

const { isAdmin, requireAdmin } = await import("~/services/admin.server");

describe("isAdmin", () => {
	beforeEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns true when email is in ADMIN_EMAILS", () => {
		vi.stubEnv("ADMIN_EMAILS", "admin@example.com,boss@example.com");
		expect(isAdmin("admin@example.com")).toBe(true);
	});

	it("is case-insensitive", () => {
		vi.stubEnv("ADMIN_EMAILS", "Admin@Example.com");
		expect(isAdmin("admin@example.com")).toBe(true);
	});

	it("returns false when email is not in ADMIN_EMAILS", () => {
		vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
		expect(isAdmin("nobody@example.com")).toBe(false);
	});

	it("returns false when ADMIN_EMAILS is not set", () => {
		delete process.env.ADMIN_EMAILS;
		expect(isAdmin("admin@example.com")).toBe(false);
	});

	it("handles whitespace in ADMIN_EMAILS", () => {
		vi.stubEnv("ADMIN_EMAILS", " admin@example.com , boss@example.com ");
		expect(isAdmin("admin@example.com")).toBe(true);
		expect(isAdmin("boss@example.com")).toBe(true);
	});
});

describe("requireAdmin", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.unstubAllEnvs();
	});

	it("returns user when they are an admin", async () => {
		vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
		const user = { id: "u1", email: "admin@example.com", name: "Admin" };
		mockRequireUser.mockResolvedValue(user);

		const result = await requireAdmin(new Request("http://localhost/admin"));
		expect(result).toEqual(user);
	});

	it("throws 403 when user is not an admin", async () => {
		vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
		mockRequireUser.mockResolvedValue({
			id: "u2",
			email: "nobody@example.com",
			name: "Nobody",
		});

		try {
			await requireAdmin(new Request("http://localhost/admin"));
			expect.fail("Expected requireAdmin to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(403);
		}
	});

	it("calls requireUser with the request", async () => {
		vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
		const user = { id: "u1", email: "admin@example.com", name: "Admin" };
		mockRequireUser.mockResolvedValue(user);

		const req = new Request("http://localhost/admin");
		await requireAdmin(req);
		expect(mockRequireUser).toHaveBeenCalledWith(req);
	});
});
