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
	getGroupById: vi.fn(),
}));

// Mock email service
vi.mock("~/services/email.server", () => ({
	sendAvailabilityReminderNotification: vi.fn(),
}));

// Mock webhook service
vi.mock("~/services/webhook.server", () => ({
	sendAvailabilityReminderWebhook: vi.fn(),
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
	getNonRespondents: vi.fn(),
	updateReminderSentAt: vi.fn(),
	getReminderSentAt: vi.fn().mockResolvedValue(null),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock rate limiting — allow all by default
vi.mock("~/services/rate-limit.server", () => ({
	checkReminderRateLimit: vi.fn().mockReturnValue({ limited: false }),
}));

import { action, loader } from "~/routes/groups.$groupId.availability.$requestId";
import {
	deleteAvailabilityRequest,
	getAvailabilityRequest,
	getNonRespondents,
	getReminderSentAt,
	submitAvailabilityResponse,
	updateReminderSentAt,
} from "~/services/availability.server";
import { sendAvailabilityReminderNotification } from "~/services/email.server";
import { getGroupById, isGroupAdmin, requireGroupMember } from "~/services/groups.server";
import { checkReminderRateLimit } from "~/services/rate-limit.server";
import { sendAvailabilityReminderWebhook } from "~/services/webhook.server";

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

describe("availability request sendReminder action", () => {
	const mockAvailRequest = {
		id: "r1",
		groupId: "g1",
		title: "March Rehearsals",
		status: "open",
		dateRangeStart: "2025-03-01T00:00:00.000Z",
		dateRangeEnd: "2025-03-28T00:00:00.000Z",
		expiresAt: "2025-04-01T00:00:00.000Z",
		createdById: "user-1",
	};

	const mockNonRespondents = [
		{
			userId: "user-2",
			name: "Alice",
			email: "alice@example.com",
			notificationPreferences: { availabilityRequests: { email: true } },
		},
		{
			userId: "user-3",
			name: "Bob",
			email: "bob@example.com",
			notificationPreferences: { availabilityRequests: { email: true } },
		},
	];

	const mockGroup = {
		id: "g1",
		name: "Test Troupe",
		webhookUrl: null,
		inviteCode: "ABCD1234",
		createdById: "user-1",
		membersCanCreateRequests: false,
		membersCanCreateEvents: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.APP_URL = "https://mycalltime.app";
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockAvailRequest);
		(getNonRespondents as ReturnType<typeof vi.fn>).mockResolvedValue(mockNonRespondents);
		(getGroupById as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroup);
		(updateReminderSentAt as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
	});

	function makeReminderRequest() {
		const formData = new FormData();
		formData.set("intent", "sendReminder");
		return new Request("http://localhost/groups/g1/availability/r1", {
			method: "POST",
			body: formData,
		});
	}

	it("admin can send reminder", async () => {
		const result = await action({
			request: makeReminderRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({
			success: true,
			message: "Reminder sent to 2 members!",
		});
	});

	it("non-admin gets 403", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);

		try {
			await action({
				request: makeReminderRequest(),
				params: { groupId: "g1", requestId: "r1" },
				context: {},
			});
			expect.fail("Should have thrown 403");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(403);
		}
	});

	it("closed request returns error", async () => {
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockAvailRequest,
			status: "closed",
		});

		const result = await action({
			request: makeReminderRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({ error: "Cannot send reminders for a closed request." });
	});

	it("returns success when all responded", async () => {
		(getNonRespondents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const result = await action({
			request: makeReminderRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({
			success: true,
			message: "Everyone has already responded!",
		});
	});

	it("calls sendAvailabilityReminderNotification with correct args", async () => {
		await action({
			request: makeReminderRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(sendAvailabilityReminderNotification).toHaveBeenCalledWith({
			requestTitle: "March Rehearsals",
			groupName: "Test Troupe",
			dateRange: expect.stringContaining("–"),
			expiresAt: expect.any(String),
			recipients: [
				{
					email: "alice@example.com",
					name: "Alice",
					notificationPreferences: { availabilityRequests: { email: true } },
				},
				{
					email: "bob@example.com",
					name: "Bob",
					notificationPreferences: { availabilityRequests: { email: true } },
				},
			],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
			preferencesUrl: "https://mycalltime.app/groups/g1/notifications",
		});
	});

	it("calls webhook when group has webhookUrl", async () => {
		(getGroupById as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockGroup,
			webhookUrl: "https://discord.com/api/webhooks/123/abc",
		});

		await action({
			request: makeReminderRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(sendAvailabilityReminderWebhook).toHaveBeenCalledWith(
			"https://discord.com/api/webhooks/123/abc",
			{
				groupName: "Test Troupe",
				title: "March Rehearsals",
				nonRespondentNames: ["Alice", "Bob"],
				requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
			},
		);
	});

	it("does NOT call webhook when no webhookUrl", async () => {
		await action({
			request: makeReminderRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(sendAvailabilityReminderWebhook).not.toHaveBeenCalled();
	});

	it("calls updateReminderSentAt", async () => {
		await action({
			request: makeReminderRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(updateReminderSentAt).toHaveBeenCalledWith("r1");
	});

	it("returns 404 for cross-group request", async () => {
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockAvailRequest,
			groupId: "other-group",
		});

		try {
			await action({
				request: makeReminderRequest(),
				params: { groupId: "g1", requestId: "r1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}
	});

	it("respects rate limit", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(checkReminderRateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce({
			limited: true,
			retryAfter: 300,
		});

		const result = await action({
			request: makeReminderRequest(),
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result).toEqual({
			error: "Reminder already sent recently. Try again in 300 seconds.",
		});
		expect(getNonRespondents).not.toHaveBeenCalled();
	});
});

import { getAggregatedResults, getUserResponse } from "~/services/availability.server";

describe("availability request loader", () => {
	const mockAvailRequest = {
		id: "r1",
		groupId: "g1",
		title: "March Rehearsals",
		description: null,
		status: "open",
		dateRangeStart: "2025-03-01T00:00:00.000Z",
		dateRangeEnd: "2025-03-28T00:00:00.000Z",
		requestedDates: ["2025-03-15", "2025-03-16"],
		requestedStartTime: null,
		requestedEndTime: null,
		expiresAt: null,
		createdById: "user-1",
		createdAt: "2025-03-01T00:00:00.000Z",
		createdByName: "Test User",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockAvailRequest);
		(getUserResponse as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(getReminderSentAt as ReturnType<typeof vi.fn>).mockResolvedValue(null);
	});

	it("loads availability request detail page", async () => {
		const request = new Request("http://localhost/groups/g1/availability/r1");
		const result = await loader({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result.availRequest).toEqual(mockAvailRequest);
		expect(result.reminderSentAt).toBeNull();
	});

	it("returns reminderSentAt when available", async () => {
		const sentDate = "2025-03-10T12:00:00.000Z";
		(getReminderSentAt as ReturnType<typeof vi.fn>).mockResolvedValue(sentDate);

		const request = new Request("http://localhost/groups/g1/availability/r1");
		const result = await loader({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result.reminderSentAt).toBe(sentDate);
		expect(getReminderSentAt).toHaveBeenCalledWith("r1");
	});

	it("page loads even when getReminderSentAt fails (missing column)", async () => {
		(getReminderSentAt as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const request = new Request("http://localhost/groups/g1/availability/r1");
		const result = await loader({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result.availRequest).toEqual(mockAvailRequest);
		expect(result.reminderSentAt).toBeNull();
		expect(result.isAdmin).toBe(false);
	});

	it("throws 404 when request not found", async () => {
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const request = new Request("http://localhost/groups/g1/availability/r1");
		try {
			await loader({
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

	it("throws 404 when request belongs to different group", async () => {
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			...mockAvailRequest,
			groupId: "other-group",
		});

		const request = new Request("http://localhost/groups/g1/availability/r1");
		try {
			await loader({
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

	it("includes aggregated results for admins", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		const mockResults = {
			dates: [],
			totalMembers: 5,
			totalResponded: 3,
		};
		(getAggregatedResults as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);

		const request = new Request("http://localhost/groups/g1/availability/r1");
		const result = await loader({
			request,
			params: { groupId: "g1", requestId: "r1" },
			context: {},
		});

		expect(result.isAdmin).toBe(true);
		expect(result.results).toEqual(mockResults);
		expect(result.nonRespondentCount).toBe(2);
	});
});
