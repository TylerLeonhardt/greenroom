import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
}));

vi.mock("~/services/groups.server", () => ({
	createGroup: vi.fn().mockResolvedValue({ id: "group-1" }),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action } from "~/routes/groups.new";
import { createGroup } from "~/services/groups.server";

describe("groups.new validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns error when name is empty", async () => {
		const formData = new FormData();
		formData.set("name", "");
		const request = new Request("http://localhost/groups/new", {
			method: "POST",
			body: formData,
		});
		const result = await action({ request, params: {}, context: {} });
		expect(result).toEqual({ errors: { name: "Group name is required." } });
	});

	it("returns error when name exceeds 100 characters", async () => {
		const formData = new FormData();
		formData.set("name", "A".repeat(101));
		const request = new Request("http://localhost/groups/new", {
			method: "POST",
			body: formData,
		});
		const result = await action({ request, params: {}, context: {} });
		expect(result).toEqual({
			errors: { name: "Group name must be 100 characters or less." },
		});
	});

	it("returns error when description exceeds 2000 characters", async () => {
		const formData = new FormData();
		formData.set("name", "Valid Group");
		formData.set("description", "A".repeat(2001));
		const request = new Request("http://localhost/groups/new", {
			method: "POST",
			body: formData,
		});
		const result = await action({ request, params: {}, context: {} });
		expect(result).toEqual({
			errors: { description: "Description must be 2000 characters or less." },
		});
	});

	it("trims whitespace from name before validation", async () => {
		(createGroup as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "group-1" });
		const formData = new FormData();
		formData.set("name", "  My Group  ");
		const request = new Request("http://localhost/groups/new", {
			method: "POST",
			body: formData,
		});
		const result = await action({ request, params: {}, context: {} });
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("creates group with valid input", async () => {
		(createGroup as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "group-1" });
		const formData = new FormData();
		formData.set("name", "My Improv Group");
		formData.set("description", "A fun group");
		const request = new Request("http://localhost/groups/new", {
			method: "POST",
			body: formData,
		});
		const result = await action({ request, params: {}, context: {} });
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect(createGroup).toHaveBeenCalled();
	});
});
