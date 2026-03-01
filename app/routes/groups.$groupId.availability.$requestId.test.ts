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
	requireGroupMember: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
	isGroupAdmin: vi.fn().mockResolvedValue(false),
}));

// Mock availability service
vi.mock("~/services/availability.server", () => ({
	getAvailabilityRequest: vi.fn(),
	getUserResponse: vi.fn().mockResolvedValue(null),
	getAggregatedResults: vi.fn(),
	submitAvailabilityResponse: vi.fn(),
	closeAvailabilityRequest: vi.fn(),
	reopenAvailabilityRequest: vi.fn(),
	deleteAvailabilityRequest: vi.fn(),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action } from "~/routes/groups.$groupId.availability.$requestId";
import {
	deleteAvailabilityRequest,
	getAvailabilityRequest,
	submitAvailabilityResponse,
} from "~/services/availability.server";
import { isGroupAdmin, requireGroupMember } from "~/services/groups.server";

describe("availability response action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
	});

	it("saves availability response with valid data", async () => {
		const responses = { "2025-03-15": "available", "2025-03-16": "maybe" };
		const formData = new FormData();
		formData.set("intent", "respond");
		formData.set("responses", JSON.stringify(responses));

		const request = new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(submitAvailabilityResponse).toHaveBeenCalledWith({
			requestId: "r1",
			userId: "user-1",
			responses,
		});
		expect(result).toEqual({ success: true, message: "Response saved!" });
	});

	it("returns error for empty responses", async () => {
		const formData = new FormData();
		formData.set("intent", "respond");
		formData.set("responses", "{}");

		const request = new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({ error: "Please respond to at least one date." });
		expect(submitAvailabilityResponse).not.toHaveBeenCalled();
	});

	it("returns error for invalid JSON responses", async () => {
		const formData = new FormData();
		formData.set("intent", "respond");
		formData.set("responses", "not valid json");

		const request = new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({ error: "Invalid response data." });
	});

	it("returns error for invalid intent", async () => {
		const formData = new FormData();
		formData.set("intent", "invalid");

		const request = new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({ error: "Invalid action." });
	});

	it("rejects responses with invalid status values", async () => {
		const formData = new FormData();
		formData.set("intent", "respond");
		formData.set("responses", JSON.stringify({ "2025-03-15": "hacked_value" }));

		const request = new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({ error: "Invalid response data." });
		expect(submitAvailabilityResponse).not.toHaveBeenCalled();
	});

	it("rejects responses with invalid date keys", async () => {
		const formData = new FormData();
		formData.set("intent", "respond");
		formData.set("responses", JSON.stringify({ "not-a-date": "available" }));

		const request = new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({ error: "Invalid response data." });
		expect(submitAvailabilityResponse).not.toHaveBeenCalled();
	});

	it("prevents close/reopen of availability request from another group", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		const { getAvailabilityRequest } = await import("~/services/availability.server");
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "r1",
			groupId: "other-group",
			title: "Other Group Request",
		});

		const formData = new FormData();
		formData.set("intent", "close");

		const request = new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", requestId: "r1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}
	});

	it("redirects unauthenticated users to login", async () => {
		(requireGroupMember as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Response(null, { status: 302, headers: { Location: "/login" } }),
		);

		const formData = new FormData();
		formData.set("intent", "respond");
		formData.set("responses", '{"2025-03-15":"available"}');

		const request = new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", requestId: "r1" },
				context: {},
			});
			expect.fail("Should have thrown a redirect");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).headers.get("Location")).toBe("/login");
		}
	});
});

describe("availability request delete action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
	});

	function makeDeleteRequest() {
		const formData = new FormData();
		formData.set("intent", "delete");
		return new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});
	}

	it("allows admin to delete any availability request", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "r1",
			groupId: "g1",
			createdById: "other-user",
			title: "Test Request",
		});

		const result = await action({
			request: makeDeleteRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect((result as Response).headers.get("Location")).toBe("/groups/g1/availability");
		expect(deleteAvailabilityRequest).toHaveBeenCalledWith("r1");
	});

	it("allows creator to delete their own request", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "r1",
			groupId: "g1",
			createdById: "user-1",
			title: "My Request",
		});

		const result = await action({
			request: makeDeleteRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect(deleteAvailabilityRequest).toHaveBeenCalledWith("r1");
	});

	it("prevents non-admin non-creator from deleting", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "r1",
			groupId: "g1",
			createdById: "other-user",
			title: "Someone Else Request",
		});

		try {
			await action({
				request: makeDeleteRequest(),
				params: { groupId: "g1", requestId: "r1" },
				context: {},
			});
			expect.fail("Should have thrown 403");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(403);
		}

		expect(deleteAvailabilityRequest).not.toHaveBeenCalled();
	});

	it("prevents deleting a request from another group (IDOR)", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "r1",
			groupId: "other-group",
			createdById: "user-1",
			title: "Cross-group Request",
		});

		try {
			await action({
				request: makeDeleteRequest(),
				params: { groupId: "g1", requestId: "r1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(deleteAvailabilityRequest).not.toHaveBeenCalled();
	});

	it("returns 404 when request does not exist", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		try {
			await action({
				request: makeDeleteRequest(),
				params: { groupId: "g1", requestId: "r1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(deleteAvailabilityRequest).not.toHaveBeenCalled();
	});
});
