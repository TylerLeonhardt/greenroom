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
	getGroupWithMembers: vi.fn().mockResolvedValue({
		group: { id: "g1", name: "Test Group" },
		members: [{ id: "user-1", name: "Test User", email: "test@example.com" }],
	}),
	getGroupMembersWithPreferences: vi.fn().mockResolvedValue([]),
}));

// Mock events service
vi.mock("~/services/events.server", () => ({
	getEventWithAssignments: vi.fn(),
	getGroupEventSummaries: vi.fn().mockResolvedValue([]),
	getEventActivityFeed: vi.fn().mockResolvedValue([]),
	assignToEvent: vi.fn(),
	updateAssignmentStatus: vi.fn(),
	updateAssignmentRole: vi.fn(),
	removeAssignment: vi.fn(),
	bulkAssignToEvent: vi.fn(),
	deleteEvent: vi.fn(),
	getAvailabilityRequestGroupId: vi.fn(),
	getAvailabilityForEventDate: vi.fn(),
	recordRsvpChange: vi.fn(),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock email service
vi.mock("~/services/email.server", () => ({
	sendEventAssignmentNotification: vi.fn().mockResolvedValue(undefined),
	sendRoleChangeNotification: vi.fn().mockResolvedValue(undefined),
}));

import {
	sendEventAssignmentNotification,
	sendRoleChangeNotification,
} from "~/services/email.server";
import {
	assignToEvent,
	bulkAssignToEvent,
	deleteEvent,
	getEventWithAssignments,
	updateAssignmentRole,
	updateAssignmentStatus,
} from "~/services/events.server";
import {
	getGroupMembersWithPreferences,
	getGroupWithMembers,
	isGroupAdmin,
	requireGroupMember,
} from "~/services/groups.server";
import { action } from "./groups.$groupId.events.$eventId";

describe("event detail action — IDOR prevention", () => {
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

	it("prevents confirming assignment on event from another group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "other-group", title: "Other Group Event" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("intent", "confirm");

		const request = new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", eventId: "event-1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(updateAssignmentStatus).not.toHaveBeenCalled();
	});

	it("prevents self-registration on event from another group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "other-group", title: "Other Group Event" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("intent", "attend");

		const request = new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", eventId: "event-1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(assignToEvent).not.toHaveBeenCalled();
	});

	it("allows confirming assignment on event in the same group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "g1", title: "My Event" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("intent", "confirm");

		const request = new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentStatus).toHaveBeenCalledWith("event-1", "user-1", "confirmed");
	});

	it("returns 404 when event does not exist", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const formData = new FormData();
		formData.set("intent", "confirm");

		const request = new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", eventId: "event-1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}
	});
});

describe("event detail action — decline attendance", () => {
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

	it("allows self-declining attendance on event in the same group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "g1", title: "My Event" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("intent", "decline-attendance");

		const request = new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(assignToEvent).toHaveBeenCalledWith("event-1", "user-1", "Viewer");
		expect(updateAssignmentStatus).toHaveBeenCalledWith("event-1", "user-1", "declined");
	});

	it("prevents self-declining on event from another group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "other-group", title: "Other Group Event" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("intent", "decline-attendance");

		const request = new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", eventId: "event-1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(assignToEvent).not.toHaveBeenCalled();
	});
});

describe("event detail action — delete authorization", () => {
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
		return new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});
	}

	it("allows admin to delete any event", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "g1", title: "My Event", createdById: "other-user" },
			assignments: [],
		});

		const result = await action({
			request: makeDeleteRequest(),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect((result as Response).headers.get("Location")).toBe("/groups/g1/events");
		expect(deleteEvent).toHaveBeenCalledWith("event-1");
	});

	it("allows event creator to delete their own event", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "g1", title: "My Event", createdById: "user-1" },
			assignments: [],
		});

		const result = await action({
			request: makeDeleteRequest(),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect(deleteEvent).toHaveBeenCalledWith("event-1");
	});

	it("rejects delete from non-admin non-creator member", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "g1", title: "My Event", createdById: "other-user" },
			assignments: [],
		});

		try {
			await action({
				request: makeDeleteRequest(),
				params: { groupId: "g1", eventId: "event-1" },
				context: {},
			});
			expect.fail("Should have thrown 403");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(403);
		}

		expect(deleteEvent).not.toHaveBeenCalled();
	});

	it("prevents deleting event from another group", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: {
				id: "event-1",
				groupId: "other-group",
				title: "Other Event",
				createdById: "user-1",
			},
			assignments: [],
		});

		try {
			await action({
				request: makeDeleteRequest(),
				params: { groupId: "g1", eventId: "event-1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(deleteEvent).not.toHaveBeenCalled();
	});
});

describe("event detail action — assignment notifications", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
	});

	it("sends notification to newly assigned users", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: {
				id: "event-1",
				groupId: "g1",
				title: "Friday Show",
				eventType: "show",
				startTime: "2026-03-15T19:00:00.000Z",
				endTime: "2026-03-15T21:00:00.000Z",
			},
			assignments: [],
		});
		(getGroupWithMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
			group: { id: "g1", name: "Test Group" },
			members: [
				{ id: "user-1", name: "Test User", email: "test@example.com" },
				{ id: "user-2", name: "New Performer", email: "new@example.com" },
			],
		});
		(getGroupMembersWithPreferences as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: "user-2",
				name: "New Performer",
				email: "new@example.com",
				timezone: "UTC",
				notificationPreferences: {},
			},
		]);

		const formData = new FormData();
		formData.set("intent", "assign");
		formData.append("userIds", "user-2");
		formData.set("role", "Performer");

		const request = new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(bulkAssignToEvent).toHaveBeenCalledWith("event-1", ["user-2"], "Performer");

		// Allow the fire-and-forget async to complete
		await vi.waitFor(() => {
			expect(sendEventAssignmentNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					eventTitle: "Friday Show",
					eventType: "show",
					dateTime: "Sun, Mar 15 · 7:00 PM – 9:00 PM",
					groupName: "Test Group",
					recipient: expect.objectContaining({
						email: "new@example.com",
						name: "New Performer",
					}),
				}),
			);
		});
	});

	it("does not send notification to already-assigned users", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: {
				id: "event-1",
				groupId: "g1",
				title: "Friday Show",
				eventType: "show",
				startTime: "2026-03-15T19:00:00.000Z",
				endTime: "2026-03-15T21:00:00.000Z",
			},
			assignments: [
				{ userId: "user-2", userName: "Existing User", role: "Performer", status: "confirmed" },
			],
		});
		(getGroupWithMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
			group: { id: "g1", name: "Test Group" },
			members: [
				{ id: "user-1", name: "Test User", email: "test@example.com" },
				{ id: "user-2", name: "Existing User", email: "existing@example.com" },
			],
		});

		const formData = new FormData();
		formData.set("intent", "assign");
		formData.append("userIds", "user-2");
		formData.set("role", "Performer");

		const request = new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(bulkAssignToEvent).toHaveBeenCalled();
		// Should NOT send email because user-2 was already assigned
		expect(sendEventAssignmentNotification).not.toHaveBeenCalled();
	});
});

describe("event detail action — change role", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
	});

	const mockShowEvent = {
		id: "event-1",
		groupId: "g1",
		title: "Friday Show",
		eventType: "show",
		startTime: "2026-03-15T19:00:00.000Z",
		endTime: "2026-03-15T21:00:00.000Z",
	};

	function makeChangeRoleRequest(fields: Record<string, string>) {
		const formData = new FormData();
		formData.set("intent", "change-role");
		for (const [key, value] of Object.entries(fields)) {
			formData.set(key, value);
		}
		return new Request("http://localhost/groups/g1/events/event-1", {
			method: "POST",
			body: formData,
		});
	}

	it("changes a performer to a viewer", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Performer User", role: "Performer", status: "confirmed" },
			],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "Viewer" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalledWith("event-1", "user-2", "Viewer");
	});

	it("changes a viewer to a performer", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Viewer User", role: "Viewer", status: "confirmed" },
			],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "Performer" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalledWith("event-1", "user-2", "Performer");
	});

	it("sends email notification when sendNotification is on", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Performer User", role: "Performer", status: "confirmed" },
			],
		});
		(getGroupMembersWithPreferences as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: "user-2",
				name: "Performer User",
				email: "performer@example.com",
				timezone: "UTC",
				notificationPreferences: {},
			},
		]);
		(getGroupWithMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
			group: { id: "g1", name: "Test Group" },
			members: [],
		});

		const result = await action({
			request: makeChangeRoleRequest({
				userId: "user-2",
				newRole: "Viewer",
				sendNotification: "on",
			}),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalledWith("event-1", "user-2", "Viewer");

		await vi.waitFor(() => {
			expect(sendRoleChangeNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					eventTitle: "Friday Show",
					eventType: "show",
					newRole: "Viewer",
					recipient: expect.objectContaining({
						email: "performer@example.com",
						name: "Performer User",
					}),
				}),
			);
		});
	});

	it("does not send email notification when sendNotification is omitted", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Viewer User", role: "Viewer", status: "confirmed" },
			],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "Performer" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalled();
		expect(sendRoleChangeNotification).not.toHaveBeenCalled();
	});

	it("rejects non-admin users with 403", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Performer User", role: "Performer", status: "confirmed" },
			],
		});

		try {
			await action({
				request: makeChangeRoleRequest({ userId: "user-2", newRole: "Viewer" }),
				params: { groupId: "g1", eventId: "event-1" },
				context: {},
			});
			expect.fail("Should have thrown 403");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(403);
		}

		expect(updateAssignmentRole).not.toHaveBeenCalled();
	});

	it("prevents role change on event from another group (IDOR)", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { ...mockShowEvent, groupId: "other-group" },
			assignments: [
				{ userId: "user-2", userName: "Performer User", role: "Performer", status: "confirmed" },
			],
		});

		try {
			await action({
				request: makeChangeRoleRequest({ userId: "user-2", newRole: "Viewer" }),
				params: { groupId: "g1", eventId: "event-1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(updateAssignmentRole).not.toHaveBeenCalled();
	});

	it("returns error when user is not assigned to the event", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "Performer" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ error: "User is not assigned to this event." });
		expect(updateAssignmentRole).not.toHaveBeenCalled();
	});

	it("returns error for invalid role", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Some User", role: "Performer", status: "confirmed" },
			],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "InvalidRole" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ error: "Invalid role." });
		expect(updateAssignmentRole).not.toHaveBeenCalled();
	});
});
