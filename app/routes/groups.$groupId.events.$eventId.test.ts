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
}));

// Mock events service
vi.mock("~/services/events.server", () => ({
	getEventWithAssignments: vi.fn(),
	assignToEvent: vi.fn(),
	updateAssignmentStatus: vi.fn(),
	removeAssignment: vi.fn(),
	bulkAssignToEvent: vi.fn(),
	deleteEvent: vi.fn(),
	getAvailabilityRequestGroupId: vi.fn(),
	getAvailabilityForEventDate: vi.fn(),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import {
	assignToEvent,
	deleteEvent,
	getEventWithAssignments,
	updateAssignmentStatus,
} from "~/services/events.server";
import { isGroupAdmin, requireGroupMember } from "~/services/groups.server";
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
