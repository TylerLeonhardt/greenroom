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
	getGroupWithMembers: vi.fn().mockResolvedValue({
		group: { id: "g1", name: "Test Group" },
		members: [{ id: "user-1", name: "Test User", email: "test@example.com" }],
	}),
}));

// Mock events service
vi.mock("~/services/events.server", () => ({
	getEventWithAssignments: vi.fn(),
	deleteEvent: vi.fn(),
	updateEvent: vi.fn().mockResolvedValue({}),
}));

import { action } from "~/routes/groups.$groupId.events.$eventId.edit";
import { deleteEvent, getEventWithAssignments, updateEvent } from "~/services/events.server";
import { requireGroupAdmin } from "~/services/groups.server";

describe("event edit action — IDOR prevention", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
	});

	it("prevents deleting an event from another group", async () => {
		// Event belongs to group-other, not g1
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "group-other", title: "Other Group Event" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("intent", "delete");

		const request = new Request("http://localhost/groups/g1/events/event-1/edit", {
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

		expect(deleteEvent).not.toHaveBeenCalled();
	});

	it("prevents updating an event from another group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "group-other", title: "Other Group Event" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("intent", "update");
		formData.set("title", "Hijacked Title");
		formData.set("eventType", "show");
		formData.set("date", "2025-06-15");
		formData.set("startTime", "19:00");
		formData.set("endTime", "21:00");

		const request = new Request("http://localhost/groups/g1/events/event-1/edit", {
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

		expect(updateEvent).not.toHaveBeenCalled();
	});

	it("allows deleting an event that belongs to the group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { id: "event-1", groupId: "g1", title: "My Event" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("intent", "delete");

		const request = new Request("http://localhost/groups/g1/events/event-1/edit", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect(deleteEvent).toHaveBeenCalledWith("event-1");
	});

	it("returns 404 when event does not exist", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const formData = new FormData();
		formData.set("intent", "delete");

		const request = new Request("http://localhost/groups/g1/events/event-1/edit", {
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
