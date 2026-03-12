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
		timezone: "America/New_York",
	}),
	isGroupAdmin: vi.fn().mockResolvedValue(true),
	getGroupById: vi.fn().mockResolvedValue({
		id: "g1",
		name: "Test Group",
		webhookUrl: null,
	}),
	getGroupMembersWithPreferences: vi.fn().mockResolvedValue([]),
}));

// Mock events service
vi.mock("~/services/events.server", () => ({
	getEventWithAssignments: vi.fn(),
	deleteEvent: vi.fn(),
	updateEvent: vi.fn().mockResolvedValue({}),
	resetEventConfirmations: vi.fn(),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock email service
vi.mock("~/services/email.server", () => ({
	sendEventEditedNotification: vi.fn(),
	sendEventReconfirmationNotification: vi.fn(),
}));

// Mock webhook service
vi.mock("~/services/webhook.server", () => ({
	sendEventEditedWebhook: vi.fn(),
}));

import { action } from "~/routes/groups.$groupId.events.$eventId.edit";
import {
	deleteEvent,
	getEventWithAssignments,
	resetEventConfirmations,
	updateEvent,
} from "~/services/events.server";
import { isGroupAdmin, requireGroupMember } from "~/services/groups.server";

const defaultEvent = {
	id: "event-1",
	groupId: "g1",
	title: "My Rehearsal",
	eventType: "rehearsal" as const,
	startTime: new Date("2099-06-15T23:00:00Z"),
	endTime: new Date("2099-06-16T01:00:00Z"),
	location: null,
	description: null,
	callTime: null,
	timezone: "America/New_York",
	createdById: "user-1",
	createdByName: "Test User",
	createdFromRequestId: null,
	reminderSentAt: null,
	confirmationReminderSentAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("event edit action — IDOR prevention", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
			timezone: "America/New_York",
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
	});

	it("prevents deleting an event from another group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { ...defaultEvent, groupId: "group-other" },
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
			event: { ...defaultEvent, groupId: "group-other" },
			assignments: [],
		});

		const formData = new FormData();
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
			event: { ...defaultEvent },
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

describe("event edit action — permissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-2",
			email: "other@example.com",
			name: "Other User",
			profileImage: null,
			timezone: "America/New_York",
		});
	});

	it("returns 403 when non-admin non-creator tries to edit", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { ...defaultEvent, createdById: "user-1" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("title", "Hack");
		formData.set("eventType", "show");
		formData.set("date", "2099-06-15");
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
			expect.fail("Should have thrown 403");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(403);
		}

		expect(updateEvent).not.toHaveBeenCalled();
	});

	it("allows creator (non-admin) to edit their own event", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { ...defaultEvent, createdById: "user-2" },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("title", "Updated Title");
		formData.set("eventType", "rehearsal");
		formData.set("date", "2099-06-15");
		formData.set("startTime", "19:00");
		formData.set("endTime", "21:00");
		formData.set("timezone", "America/New_York");

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
		expect(updateEvent).toHaveBeenCalled();
	});
});

describe("event edit action — validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
			timezone: "America/New_York",
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { ...defaultEvent },
			assignments: [],
		});
	});

	function makeUpdateRequest(fields: Record<string, string>) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(fields)) {
			formData.set(key, value);
		}
		return new Request("http://localhost/groups/g1/events/event-1/edit", {
			method: "POST",
			body: formData,
		});
	}

	const validFields = {
		title: "Updated Show",
		eventType: "show",
		date: "2099-06-15",
		startTime: "19:00",
		endTime: "21:00",
	};

	it("returns error when title exceeds 200 characters", async () => {
		const result = await action({
			request: makeUpdateRequest({ ...validFields, title: "A".repeat(201) }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});
		expect(result).toEqual({ error: "Title must be 200 characters or less." });
	});

	it("returns error when call time is after start time", async () => {
		const result = await action({
			request: makeUpdateRequest({ ...validFields, callTime: "20:00" }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});
		expect(result).toEqual({ error: "Call time must be before start time." });
	});

	it("returns error when location exceeds 200 characters", async () => {
		const result = await action({
			request: makeUpdateRequest({ ...validFields, location: "A".repeat(201) }),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});
		expect(result).toEqual({ error: "Location must be 200 characters or less." });
	});

	it("allows valid update", async () => {
		const result = await action({
			request: makeUpdateRequest(validFields),
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect(updateEvent).toHaveBeenCalled();
	});
});

describe("event edit action — change detection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
			timezone: "America/New_York",
		});
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
	});

	it("redirects without updating when nothing changed", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { ...defaultEvent },
			assignments: [],
		});

		const formData = new FormData();
		formData.set("title", defaultEvent.title);
		formData.set("eventType", defaultEvent.eventType);
		formData.set("date", "2099-06-15");
		formData.set("startTime", "19:00");
		formData.set("endTime", "21:00");
		formData.set("timezone", "America/New_York");

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
		expect(updateEvent).not.toHaveBeenCalled();
	});

	it("calls resetEventConfirmations when requestReconfirmation is checked", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { ...defaultEvent },
			assignments: [{ userId: "user-2", role: null, status: "confirmed", assignedAt: new Date() }],
		});

		const formData = new FormData();
		formData.set("title", "Changed Title");
		formData.set("eventType", "rehearsal");
		formData.set("date", "2099-06-15");
		formData.set("startTime", "19:00");
		formData.set("endTime", "21:00");
		formData.set("timezone", "America/New_York");
		formData.set("requestReconfirmation", "on");

		const request = new Request("http://localhost/groups/g1/events/event-1/edit", {
			method: "POST",
			body: formData,
		});

		await action({
			request,
			params: { groupId: "g1", eventId: "event-1" },
			context: {},
		});

		expect(resetEventConfirmations).toHaveBeenCalledWith("event-1");
	});
});
