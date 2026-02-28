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
	getAvailabilityRequestGroupId: vi.fn(),
	getAvailabilityForEventDate: vi.fn(),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import {
	assignToEvent,
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
