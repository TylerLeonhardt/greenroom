import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
		timezone: "America/New_York",
	}),
}));

vi.mock("~/services/groups.server", () => ({
	requireGroupAdminOrPermission: vi.fn().mockResolvedValue({
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

vi.mock("~/services/events.server", () => ({
	createEvent: vi.fn().mockResolvedValue({ id: "event-1" }),
	bulkAssignToEvent: vi.fn(),
	getAvailabilityForEventDate: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/services/availability.server", () => ({
	getAvailabilityRequest: vi.fn().mockResolvedValue(null),
}));

vi.mock("~/services/email.server", () => ({
	sendEventCreatedNotification: vi.fn(),
	sendEventFromAvailabilityNotification: vi.fn(),
}));

import { action } from "~/routes/groups.$groupId.events.new";

function makeRequest(fields: Record<string, string | string[]>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (Array.isArray(value)) {
			for (const v of value) {
				formData.append(key, v);
			}
		} else {
			formData.set(key, value);
		}
	}
	return new Request("http://localhost/groups/g1/events/new", {
		method: "POST",
		body: formData,
	});
}

const validEvent = {
	title: "Friday Show",
	eventType: "rehearsal",
	date: "2099-06-15",
	startTime: "19:00",
	endTime: "21:00",
	timezone: "America/New_York",
};

describe("events.new validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns error when title is empty", async () => {
		const result = await action({
			request: makeRequest({ ...validEvent, title: "" }),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Title is required." });
	});

	it("returns error when title exceeds 200 characters", async () => {
		const result = await action({
			request: makeRequest({ ...validEvent, title: "A".repeat(201) }),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Title must be 200 characters or less." });
	});

	it("returns error for invalid event type", async () => {
		const result = await action({
			request: makeRequest({ ...validEvent, eventType: "concert" }),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Please select an event type." });
	});

	it("returns error when end time is not after start time", async () => {
		const result = await action({
			request: makeRequest({ ...validEvent, startTime: "21:00", endTime: "19:00" }),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "End time must be after start time." });
	});

	it("returns error when call time is after start time", async () => {
		const result = await action({
			request: makeRequest({
				...validEvent,
				eventType: "show",
				callTime: "20:00",
			}),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Call time must be before start time." });
	});

	it("returns error when call time equals start time", async () => {
		const result = await action({
			request: makeRequest({
				...validEvent,
				eventType: "show",
				callTime: "19:00",
			}),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Call time must be before start time." });
	});

	it("accepts call time before start time", async () => {
		const result = await action({
			request: makeRequest({
				...validEvent,
				eventType: "show",
				callTime: "18:00",
			}),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("returns error when location exceeds 200 characters", async () => {
		const result = await action({
			request: makeRequest({ ...validEvent, location: "A".repeat(201) }),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Location must be 200 characters or less." });
	});

	it("creates event with valid input", async () => {
		const result = await action({
			request: makeRequest(validEvent),
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});
});
