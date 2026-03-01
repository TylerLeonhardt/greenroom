import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
}));

// Mock groups service
vi.mock("~/services/groups.server", () => ({
	requireGroupAdmin: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
	getGroupById: vi.fn().mockResolvedValue({
		id: "g1",
		name: "Cool Improv Team",
		description: "A great team",
		inviteCode: "ABC12345",
		membersCanCreateRequests: false,
		membersCanCreateEvents: false,
	}),
	deleteGroup: vi.fn().mockResolvedValue(undefined),
	regenerateInviteCode: vi.fn().mockResolvedValue("NEWCODE1"),
	updateGroup: vi.fn().mockResolvedValue({}),
	updateGroupPermissions: vi.fn().mockResolvedValue({}),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action } from "~/routes/groups.$groupId.settings";
import { deleteGroup, getGroupById, requireGroupAdmin } from "~/services/groups.server";

describe("group settings action — delete-group", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(getGroupById as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "g1",
			name: "Cool Improv Team",
			description: "A great team",
			inviteCode: "ABC12345",
			membersCanCreateRequests: false,
			membersCanCreateEvents: false,
		});
	});

	function makeDeleteRequest(confirmName: string) {
		const formData = new FormData();
		formData.set("intent", "delete-group");
		formData.set("confirmName", confirmName);
		return new Request("http://localhost/groups/g1/settings", {
			method: "POST",
			body: formData,
		});
	}

	it("deletes group when admin provides correct group name", async () => {
		const result = await action({
			request: makeDeleteRequest("Cool Improv Team"),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect((result as Response).headers.get("Location")).toBe("/dashboard");
		expect(deleteGroup).toHaveBeenCalledWith("g1");
	});

	it("rejects deletion when group name does not match", async () => {
		const result = await action({
			request: makeDeleteRequest("Wrong Name"),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toEqual({
			error: "Group name does not match. Please type the exact group name.",
			success: false,
		});
		expect(deleteGroup).not.toHaveBeenCalled();
	});

	it("rejects deletion when confirm name is empty", async () => {
		const result = await action({
			request: makeDeleteRequest(""),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toEqual({
			error: "Group name does not match. Please type the exact group name.",
			success: false,
		});
		expect(deleteGroup).not.toHaveBeenCalled();
	});

	it("rejects non-admin users (403)", async () => {
		(requireGroupAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Response("Forbidden", { status: 403 }),
		);

		try {
			await action({
				request: makeDeleteRequest("Cool Improv Team"),
				params: { groupId: "g1" },
				context: {},
			});
			expect.fail("Should have thrown 403");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(403);
		}

		expect(deleteGroup).not.toHaveBeenCalled();
	});

	it("returns 404 when group does not exist", async () => {
		(getGroupById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		try {
			await action({
				request: makeDeleteRequest("Cool Improv Team"),
				params: { groupId: "g1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(deleteGroup).not.toHaveBeenCalled();
	});

	it("is case-sensitive for group name confirmation", async () => {
		const result = await action({
			request: makeDeleteRequest("cool improv team"),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toEqual({
			error: "Group name does not match. Please type the exact group name.",
			success: false,
		});
		expect(deleteGroup).not.toHaveBeenCalled();
	});
});
