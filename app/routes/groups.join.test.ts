import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
	getOptionalUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
}));

// Mock groups service
vi.mock("~/services/groups.server", () => ({
	joinGroup: vi.fn(),
}));

import { action } from "~/routes/groups.join";
import { requireUser } from "~/services/auth.server";
import { joinGroup } from "~/services/groups.server";

describe("groups.join action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
	});

	it("redirects to group on successful join with valid invite code", async () => {
		(joinGroup as ReturnType<typeof vi.fn>).mockResolvedValue({
			success: true,
			groupId: "group-123",
		});

		const formData = new FormData();
		formData.set("code", "ABCD2345");

		const request = new Request("http://localhost/groups/join", {
			method: "POST",
			body: formData,
		});

		const result = await action({ request, params: {}, context: {} });
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect((result as Response).headers.get("Location")).toBe("/groups/group-123");
		expect(joinGroup).toHaveBeenCalledWith("user-1", "ABCD2345");
	});

	it("returns error for invalid invite code format", async () => {
		const formData = new FormData();
		formData.set("code", "BADCODE!");

		const request = new Request("http://localhost/groups/join", {
			method: "POST",
			body: formData,
		});

		const result = await action({ request, params: {}, context: {} });
		expect(result).toEqual({ error: "Invalid invite code format. Codes are 8 characters." });
	});

	it("returns error for invalid invite code from service", async () => {
		(joinGroup as ReturnType<typeof vi.fn>).mockResolvedValue({
			success: false,
			error: "Invalid invite code.",
		});

		const formData = new FormData();
		formData.set("code", "BADCXYZQ");

		const request = new Request("http://localhost/groups/join", {
			method: "POST",
			body: formData,
		});

		const result = await action({ request, params: {}, context: {} });
		expect(result).toEqual({ error: "Invalid invite code." });
	});

	it("redirects if user is already a member", async () => {
		(joinGroup as ReturnType<typeof vi.fn>).mockResolvedValue({
			success: false,
			error: "You're already a member of this group.",
			groupId: "group-123",
		});

		const formData = new FormData();
		formData.set("code", "ABCD2345");
		const request = new Request("http://localhost/groups/join", {
			method: "POST",
			body: formData,
		});

		const result = await action({ request, params: {}, context: {} });
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect((result as Response).headers.get("Location")).toBe("/groups/group-123");
	});

	it("returns error for empty invite code", async () => {
		const formData = new FormData();
		formData.set("code", "");

		const request = new Request("http://localhost/groups/join", {
			method: "POST",
			body: formData,
		});

		const result = await action({ request, params: {}, context: {} });
		expect(result).toEqual({ error: "Invite code is required." });
	});

	it("returns error when code field is missing", async () => {
		const formData = new FormData();

		const request = new Request("http://localhost/groups/join", {
			method: "POST",
			body: formData,
		});

		const result = await action({ request, params: {}, context: {} });
		expect(result).toEqual({ error: "Invite code is required." });
	});
});
