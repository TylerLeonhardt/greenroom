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
	getAvailabilityForEventDate,
	getAvailabilityRequestGroupId,
	getEventActivityFeed,
	getEventWithAssignments,
	getGroupEventSummaries,
	updateAssignmentRole,
	updateAssignmentStatus,
} from "~/services/events.server";
import {
	getGroupMembersWithPreferences,
	getGroupWithMembers,
	isGroupAdmin,
	requireGroupMember,
} from "~/services/groups.server";
import { action, loader } from "./groups.$groupId.events.$eventId";

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

	it("accepts custom role names", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Some User", role: "Performer", status: "confirmed" },
			],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "Stage Manager" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalledWith("event-1", "user-2", "Stage Manager");
	});

	it("trims whitespace from role names", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Some User", role: "Performer", status: "confirmed" },
			],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "  Director  " }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalledWith("event-1", "user-2", "Director");
	});

	it("rejects empty role", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Some User", role: "Performer", status: "confirmed" },
			],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ error: "Role cannot be empty." });
		expect(updateAssignmentRole).not.toHaveBeenCalled();
	});

	it("rejects whitespace-only role", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Some User", role: "Performer", status: "confirmed" },
			],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "   " }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ error: "Role cannot be empty." });
		expect(updateAssignmentRole).not.toHaveBeenCalled();
	});

	it("rejects role exceeding 100 characters", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Some User", role: "Performer", status: "confirmed" },
			],
		});

		const longRole = "A".repeat(101);
		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: longRole }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ error: "Role must be 100 characters or less." });
		expect(updateAssignmentRole).not.toHaveBeenCalled();
	});

	it("accepts role at exactly 100 characters", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Some User", role: "Performer", status: "confirmed" },
			],
		});

		const maxRole = "A".repeat(100);
		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: maxRole }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalledWith("event-1", "user-2", maxRole);
	});

	it("changes role on non-show event", async () => {
		const mockRehearsalEvent = {
			id: "event-1",
			groupId: "g1",
			title: "Monday Rehearsal",
			eventType: "rehearsal",
			startTime: "2026-03-15T19:00:00.000Z",
			endTime: "2026-03-15T21:00:00.000Z",
		};
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockRehearsalEvent,
			assignments: [{ userId: "user-2", userName: "Some User", role: null, status: "confirmed" }],
		});

		const result = await action({
			request: makeChangeRoleRequest({ userId: "user-2", newRole: "Director" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalledWith("event-1", "user-2", "Director");
	});

	it("sends notification with custom role name", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [
				{ userId: "user-2", userName: "Some User", role: "Performer", status: "confirmed" },
			],
		});
		(getGroupMembersWithPreferences as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: "user-2",
				name: "Some User",
				email: "user@example.com",
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
				newRole: "Stage Manager",
				sendNotification: "on",
			}),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toEqual({ success: true });
		expect(updateAssignmentRole).toHaveBeenCalledWith("event-1", "user-2", "Stage Manager");

		await vi.waitFor(() => {
			expect(sendRoleChangeNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					newRole: "Stage Manager",
					recipient: expect.objectContaining({
						email: "user@example.com",
					}),
				}),
			);
		});
	});
});

describe("event detail loader — availability & no-response members", () => {
	const mockShowEvent = {
		id: "event-1",
		groupId: "g1",
		title: "Friday Show",
		eventType: "show",
		startTime: "2026-03-15T19:00:00.000Z",
		endTime: "2026-03-15T21:00:00.000Z",
		callTime: null,
		location: "Main Theater",
		createdFromRequestId: "req-1",
		createdById: "user-1",
	};

	const allMembers = [
		{ id: "user-1", name: "Admin", email: "admin@example.com", profileImage: null, role: "admin" },
		{ id: "user-2", name: "Alice", email: "alice@example.com", profileImage: null, role: "member" },
		{ id: "user-3", name: "Bob", email: "bob@example.com", profileImage: null, role: "member" },
		{
			id: "user-4",
			name: "Charlie",
			email: "charlie@example.com",
			profileImage: null,
			role: "member",
		},
	];

	function makeLoaderRequest() {
		return new Request("http://localhost/groups/g1/events/event-1");
	}

	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "admin@example.com",
			name: "Admin",
			profileImage: null,
			timezone: "America/New_York",
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(getGroupEventSummaries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(getEventActivityFeed as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	it("returns availability data with non-responding members inferrable when some members didn't respond", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [],
		});
		(getGroupWithMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
			group: { id: "g1", name: "Test Group" },
			members: allMembers,
		});
		(getAvailabilityRequestGroupId as ReturnType<typeof vi.fn>).mockResolvedValue("g1");
		// Only user-2 and user-3 responded; user-1 and user-4 did NOT respond
		(getAvailabilityForEventDate as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ userId: "user-2", userName: "Alice", status: "available" },
			{ userId: "user-3", userName: "Bob", status: "maybe" },
		]);

		const result = await loader({
			request: makeLoaderRequest(),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result.availabilityData).toHaveLength(2);
		expect(result.members).toHaveLength(4);

		// Verify the component can compute "no response" members:
		// noResponseUsers = members not in assignments AND not in availabilityData
		const assignedIds = new Set(result.assignments.map((a: { userId: string }) => a.userId));
		const unassigned = result.members.filter((m: { id: string }) => !assignedIds.has(m.id));
		const respondedIds = new Set(result.availabilityData.map((a: { userId: string }) => a.userId));
		const noResponseMembers = unassigned.filter((m: { id: string }) => !respondedIds.has(m.id));

		expect(noResponseMembers).toHaveLength(2);
		expect(noResponseMembers.map((m: { id: string }) => m.id).sort()).toEqual(["user-1", "user-4"]);
	});

	it("returns no non-responding members when all members responded", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockShowEvent,
			assignments: [],
		});
		(getGroupWithMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
			group: { id: "g1", name: "Test Group" },
			members: allMembers,
		});
		(getAvailabilityRequestGroupId as ReturnType<typeof vi.fn>).mockResolvedValue("g1");
		// All 4 members responded
		(getAvailabilityForEventDate as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ userId: "user-1", userName: "Admin", status: "available" },
			{ userId: "user-2", userName: "Alice", status: "available" },
			{ userId: "user-3", userName: "Bob", status: "maybe" },
			{ userId: "user-4", userName: "Charlie", status: "not_available" },
		]);

		const result = await loader({
			request: makeLoaderRequest(),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result.availabilityData).toHaveLength(4);

		// Component logic: all members responded → noResponseUsers is empty
		const assignedIds = new Set(result.assignments.map((a: { userId: string }) => a.userId));
		const unassigned = result.members.filter((m: { id: string }) => !assignedIds.has(m.id));
		const respondedIds = new Set(result.availabilityData.map((a: { userId: string }) => a.userId));
		const noResponseMembers = unassigned.filter((m: { id: string }) => !respondedIds.has(m.id));

		expect(noResponseMembers).toHaveLength(0);
	});

	it("returns empty availability data when no availability request is linked", async () => {
		const eventWithoutRequest = {
			...mockShowEvent,
			createdFromRequestId: null,
		};
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: eventWithoutRequest,
			assignments: [
				{ userId: "user-2", userName: "Alice", role: "Performer", status: "confirmed" },
			],
		});
		(getGroupWithMembers as ReturnType<typeof vi.fn>).mockResolvedValue({
			group: { id: "g1", name: "Test Group" },
			members: allMembers,
		});

		const result = await loader({
			request: makeLoaderRequest(),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		// No availability request linked → availabilityData is empty
		expect(result.availabilityData).toHaveLength(0);

		// getAvailabilityForEventDate should NOT have been called
		expect(getAvailabilityForEventDate).not.toHaveBeenCalled();

		// Component would use the fallback generic member list (not grouped availability view)
		// since hasAvailData = false, unassignedMembers would be rendered directly
		const assignedIds = new Set(result.assignments.map((a: { userId: string }) => a.userId));
		const unassigned = result.members.filter((m: { id: string }) => !assignedIds.has(m.id));
		expect(unassigned).toHaveLength(3); // user-1, user-3, user-4 (user-2 is assigned)
	});
});
