import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
		timezone: null,
	}),
}));

// Mock account service
vi.mock("~/services/account.server", () => ({
	getAccountDeletionPreview: vi.fn().mockResolvedValue({
		soleAdminGroups: [],
		sharedAdminGroups: [],
		memberOnlyGroups: [],
		createdRequestCount: 0,
		createdEventCount: 0,
	}),
	executeAccountDeletion: vi.fn().mockResolvedValue(undefined),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock("~/services/logger.server", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

// Mock session service
vi.mock("~/services/session.server", () => ({
	destroyUserSession: vi.fn().mockImplementation(async (_request, redirectTo) => {
		return new Response(null, {
			status: 302,
			headers: { Location: redirectTo },
		});
	}),
}));

import { action, loader } from "~/routes/settings.delete-account";
import { executeAccountDeletion, getAccountDeletionPreview } from "~/services/account.server";
import { requireUser } from "~/services/auth.server";
import { destroyUserSession } from "~/services/session.server";

describe("settings.delete-account loader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("requires authentication", async () => {
		(requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Response(null, { status: 302, headers: { Location: "/login" } }),
		);

		try {
			await loader({
				request: new Request("http://localhost/settings/delete-account"),
				params: {},
				context: {},
			});
			expect.fail("Should have thrown redirect");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(302);
		}
	});

	it("returns user and preview data", async () => {
		const result = await loader({
			request: new Request("http://localhost/settings/delete-account"),
			params: {},
			context: {},
		});

		expect(result).toHaveProperty("user");
		expect(result).toHaveProperty("preview");
		expect(result.user.email).toBe("test@example.com");
		expect(getAccountDeletionPreview).toHaveBeenCalledWith("user-1");
	});
});

describe("settings.delete-account action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
			timezone: null,
		});
	});

	function makeDeleteRequest(confirmEmail: string, decisions: string = "[]") {
		const formData = new FormData();
		formData.set("intent", "delete-account");
		formData.set("confirmEmail", confirmEmail);
		formData.set("decisions", decisions);
		return new Request("http://localhost/settings/delete-account", {
			method: "POST",
			body: formData,
		});
	}

	it("deletes account when email matches and no sole-admin groups", async () => {
		const result = await action({
			request: makeDeleteRequest("test@example.com"),
			params: {},
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect((result as Response).headers.get("Location")).toBe("/");
		expect(executeAccountDeletion).toHaveBeenCalledWith("user-1", []);
		expect(destroyUserSession).toHaveBeenCalled();
	});

	it("rejects when email does not match", async () => {
		const result = await action({
			request: makeDeleteRequest("wrong@example.com"),
			params: {},
			context: {},
		});

		expect(result).toEqual({
			error: "Email does not match. Please type your exact email address.",
		});
		expect(executeAccountDeletion).not.toHaveBeenCalled();
	});

	it("email comparison is case-insensitive", async () => {
		const result = await action({
			request: makeDeleteRequest("TEST@EXAMPLE.COM"),
			params: {},
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect(executeAccountDeletion).toHaveBeenCalled();
	});

	it("rejects when sole-admin group has no decision", async () => {
		(getAccountDeletionPreview as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			soleAdminGroups: [
				{
					groupId: "g1",
					groupName: "My Group",
					role: "admin",
					isSoleAdmin: true,
					memberCount: 3,
					otherAdmins: [],
					otherMembers: [{ id: "user-2", name: "Other" }],
				},
			],
			sharedAdminGroups: [],
			memberOnlyGroups: [],
			createdRequestCount: 0,
			createdEventCount: 0,
		});

		const result = await action({
			request: makeDeleteRequest("test@example.com", "[]"),
			params: {},
			context: {},
		});

		expect(result).toEqual({
			error: "Please choose what to do with all groups where you are the only admin.",
		});
		expect(executeAccountDeletion).not.toHaveBeenCalled();
	});

	it("accepts transfer decision for sole-admin group", async () => {
		(getAccountDeletionPreview as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			soleAdminGroups: [
				{
					groupId: "g1",
					groupName: "My Group",
					role: "admin",
					isSoleAdmin: true,
					memberCount: 3,
					otherAdmins: [],
					otherMembers: [{ id: "user-2", name: "Other" }],
				},
			],
			sharedAdminGroups: [],
			memberOnlyGroups: [],
			createdRequestCount: 0,
			createdEventCount: 0,
		});

		const decisions = JSON.stringify([{ action: "transfer", groupId: "g1", newAdminId: "user-2" }]);

		const result = await action({
			request: makeDeleteRequest("test@example.com", decisions),
			params: {},
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect(executeAccountDeletion).toHaveBeenCalledWith("user-1", [
			{ action: "transfer", groupId: "g1", newAdminId: "user-2" },
		]);
	});

	it("accepts delete decision for sole-admin group", async () => {
		(getAccountDeletionPreview as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			soleAdminGroups: [
				{
					groupId: "g1",
					groupName: "My Group",
					role: "admin",
					isSoleAdmin: true,
					memberCount: 1,
					otherAdmins: [],
					otherMembers: [],
				},
			],
			sharedAdminGroups: [],
			memberOnlyGroups: [],
			createdRequestCount: 0,
			createdEventCount: 0,
		});

		const decisions = JSON.stringify([{ action: "delete", groupId: "g1" }]);

		const result = await action({
			request: makeDeleteRequest("test@example.com", decisions),
			params: {},
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect(executeAccountDeletion).toHaveBeenCalledWith("user-1", [
			{ action: "delete", groupId: "g1" },
		]);
	});

	it("rejects transfer to non-member", async () => {
		(getAccountDeletionPreview as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			soleAdminGroups: [
				{
					groupId: "g1",
					groupName: "My Group",
					role: "admin",
					isSoleAdmin: true,
					memberCount: 3,
					otherAdmins: [],
					otherMembers: [{ id: "user-2", name: "Other" }],
				},
			],
			sharedAdminGroups: [],
			memberOnlyGroups: [],
			createdRequestCount: 0,
			createdEventCount: 0,
		});

		const decisions = JSON.stringify([
			{ action: "transfer", groupId: "g1", newAdminId: "nonexistent-user" },
		]);

		const result = await action({
			request: makeDeleteRequest("test@example.com", decisions),
			params: {},
			context: {},
		});

		expect(result).toEqual({
			error: "Selected transfer target is not a member of the group.",
		});
		expect(executeAccountDeletion).not.toHaveBeenCalled();
	});

	it("rejects invalid intent", async () => {
		const formData = new FormData();
		formData.set("intent", "wrong");
		const request = new Request("http://localhost/settings/delete-account", {
			method: "POST",
			body: formData,
		});

		const result = await action({ request, params: {}, context: {} });

		expect(result).toEqual({ error: "Invalid action." });
	});

	it("handles execution failure gracefully", async () => {
		(executeAccountDeletion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("DB error"),
		);

		const result = await action({
			request: makeDeleteRequest("test@example.com"),
			params: {},
			context: {},
		});

		expect(result).toEqual({
			error: "Failed to delete account. Please try again.",
		});
	});

	it("requires authentication", async () => {
		(requireUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Response(null, { status: 302, headers: { Location: "/login" } }),
		);

		try {
			await action({
				request: makeDeleteRequest("test@example.com"),
				params: {},
				context: {},
			});
			expect.fail("Should have thrown redirect");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(302);
		}

		expect(executeAccountDeletion).not.toHaveBeenCalled();
	});
});
