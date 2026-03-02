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
	removeMember: vi.fn().mockResolvedValue(undefined),
	getGroupWithMembers: vi.fn(),
	requireGroupMember: vi.fn(),
}));

vi.mock("~/services/availability.server", () => ({
	getOpenAvailabilityRequestCount: vi.fn(),
}));

vi.mock("~/services/events.server", () => ({
	getGroupEvents: vi.fn(),
}));

// Mock CSRF
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock("~/services/logger.server", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { action } from "~/routes/groups.$groupId._index";
import { removeMember } from "~/services/groups.server";
import { logger } from "~/services/logger.server";

describe("group index action — remove-member", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function makeRequest(intent: string, userId?: string) {
		const formData = new FormData();
		formData.set("intent", intent);
		if (userId !== undefined) {
			formData.set("userId", userId);
		}
		return new Request("http://localhost/groups/g1", {
			method: "POST",
			body: formData,
		});
	}

	it("returns success for remove-member with valid userId", async () => {
		const result = await action({
			request: makeRequest("remove-member", "user-2"),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(removeMember).toHaveBeenCalledWith("g1", "user-2");
	});

	it("returns error when userId is not a string (missing)", async () => {
		const result = await action({
			request: makeRequest("remove-member"),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toEqual({ error: "Invalid user." });
		expect(removeMember).not.toHaveBeenCalled();
	});

	it("returns error when userId is empty string", async () => {
		const result = await action({
			request: makeRequest("remove-member", ""),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toEqual({ error: "Invalid user." });
		expect(removeMember).not.toHaveBeenCalled();
	});

	it("returns error when removeMember throws", async () => {
		(removeMember as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("Cannot remove the last admin"),
		);

		const result = await action({
			request: makeRequest("remove-member", "user-2"),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toEqual({ error: "Cannot remove the last admin" });
		expect(logger.error).toHaveBeenCalled();
	});

	it("returns success for unknown intent", async () => {
		const result = await action({
			request: makeRequest("unknown-intent"),
			params: { groupId: "g1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(removeMember).not.toHaveBeenCalled();
	});
});
