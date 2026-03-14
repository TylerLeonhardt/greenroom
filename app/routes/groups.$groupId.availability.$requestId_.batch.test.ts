import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (before imports) ---

vi.mock("~/services/groups.server", () => ({
	requireGroupAdminOrPermission: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@test.com",
		name: "Test User",
		timezone: "UTC",
	}),
	getGroupWithMembers: vi.fn().mockResolvedValue(null),
	getGroupMembersWithPreferences: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn(),
}));

vi.mock("~/services/availability.server", () => ({
	getAvailabilityRequest: vi.fn().mockResolvedValue({
		id: "req-1",
		groupId: "g1",
		title: "March Schedule",
		status: "open",
		requestedDates: ["2026-03-15", "2026-03-16"],
	}),
}));

vi.mock("~/services/events.server", () => ({
	createEventsFromAvailability: vi.fn().mockResolvedValue([
		{
			id: "ev-1",
			groupId: "g1",
			title: "Rehearsal",
			eventType: "rehearsal",
			startTime: new Date("2026-03-15T19:00:00Z"),
			endTime: new Date("2026-03-15T21:00:00Z"),
			location: null,
			description: null,
		},
	]),
	getAvailabilityForEventDate: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/services/email.server", () => ({
	sendBatchEventsFromAvailabilityNotification: vi.fn(),
}));

vi.mock("~/services/webhook.server", () => ({
	sendBatchEventsCreatedWebhook: vi.fn(),
}));

import {
	action,
	DEFAULT_END_TIME,
	DEFAULT_START_TIME,
} from "~/routes/groups.$groupId.availability.$requestId_.batch";
import { getAvailabilityRequest } from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { createEventsFromAvailability } from "~/services/events.server";
import { requireGroupAdminOrPermission } from "~/services/groups.server";

// --- Helpers ---

function createFormData(data: Record<string, string>): FormData {
	const formData = new FormData();
	for (const [key, value] of Object.entries(data)) {
		formData.append(key, value);
	}
	return formData;
}

function createRequest(formData: FormData): Request {
	return new Request("http://test.com/groups/g1/availability/req-1/batch", {
		method: "POST",
		body: formData,
	});
}

const validFormData = {
	title: "Weekly Rehearsal",
	eventType: "rehearsal",
	startTime: "19:00",
	endTime: "21:00",
	dates: "2026-03-15,2026-03-16",
};

const actionArgs = (formData: FormData) => ({
	request: createRequest(formData),
	params: { groupId: "g1", requestId: "req-1" },
	context: {},
});

// --- Tests ---

describe("batch route action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset default mocks
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "req-1",
			groupId: "g1",
			title: "March Schedule",
			status: "open",
			requestedDates: ["2026-03-15", "2026-03-16"],
		});
		(createEventsFromAvailability as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: "ev-1",
				groupId: "g1",
				title: "Rehearsal",
				eventType: "rehearsal",
				startTime: new Date("2026-03-15T19:00:00Z"),
				endTime: new Date("2026-03-15T21:00:00Z"),
				location: null,
				description: null,
			},
		]);
	});

	it("requires authentication via requireGroupAdminOrPermission", async () => {
		const formData = createFormData(validFormData);
		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(requireGroupAdminOrPermission).toHaveBeenCalledWith(
			expect.any(Request),
			"g1",
			"membersCanCreateEvents",
		);
	});

	it("validates CSRF token", async () => {
		const formData = createFormData(validFormData);
		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(validateCsrfToken).toHaveBeenCalled();
	});

	it("returns error when title is missing", async () => {
		const formData = createFormData({ ...validFormData, title: "" });
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "Title is required." });
	});

	it("returns error when title exceeds 200 chars", async () => {
		const formData = createFormData({ ...validFormData, title: "A".repeat(201) });
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "Title must be 200 characters or less." });
	});

	it("returns error for invalid event type", async () => {
		const formData = createFormData({ ...validFormData, eventType: "invalid" });
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "Please select an event type." });
	});

	it("returns error when start time is missing", async () => {
		const formData = createFormData({ ...validFormData, startTime: "" });
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "Start time is required." });
	});

	it("returns error when end time is missing", async () => {
		const formData = createFormData({ ...validFormData, endTime: "" });
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "End time is required." });
	});

	it("returns error when end time is before start time", async () => {
		const formData = createFormData({
			...validFormData,
			startTime: "21:00",
			endTime: "19:00",
		});
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "End time must be after start time." });
	});

	it("returns error when no dates provided", async () => {
		const formData = createFormData({ ...validFormData, dates: "" });
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "No dates selected." });
	});

	it("returns error when dates are invalid format", async () => {
		const formData = createFormData({ ...validFormData, dates: "not-a-date,also-bad" });
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "No valid dates selected." });
	});

	it("returns error when description exceeds 2000 chars", async () => {
		const formData = createFormData({
			...validFormData,
			description: "A".repeat(2001),
		});
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "Description must be 2,000 characters or less." });
	});

	it("creates events on valid submission", async () => {
		const formData = createFormData(validFormData);

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				groupId: "g1",
				requestId: "req-1",
				title: "Weekly Rehearsal",
				eventType: "rehearsal",
				createdById: "user-1",
			}),
		);
	});

	it("passes per-date locations to createEventsFromAvailability", async () => {
		const formData = createFormData(validFormData);
		formData.append("location-2026-03-15", "Theater A");

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				dates: expect.arrayContaining([
					expect.objectContaining({
						date: "2026-03-15",
						location: "Theater A",
					}),
				]),
			}),
		);
	});

	it("passes description to createEventsFromAvailability", async () => {
		const formData = createFormData({
			...validFormData,
			description: "Practice time",
		});

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				description: "Practice time",
			}),
		);
	});

	it("redirects after successful creation", async () => {
		const formData = createFormData(validFormData);
		let response: Response | undefined;

		try {
			const result = await action(actionArgs(formData));
			// Remix redirect() may return or throw a Response
			if (result instanceof Response) {
				response = result;
			}
		} catch (thrown) {
			if (thrown instanceof Response) {
				response = thrown;
			}
		}

		expect(response).toBeInstanceOf(Response);
		expect(response?.status).toBe(302);
		const location = response?.headers.get("Location");
		expect(location).toContain("/groups/g1/availability/req-1");
		expect(location).toContain("batchSuccess=true");
		expect(location).toContain("count=1");
	});

	it("throws 404 when availability request does not belong to group", async () => {
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "req-1",
			groupId: "other-group",
			title: "Wrong Group",
		});

		const formData = createFormData(validFormData);

		try {
			await action(actionArgs(formData));
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}
	});

	it("uses user timezone when form timezone not provided", async () => {
		const formData = createFormData(validFormData);

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				timezone: "UTC",
			}),
		);
	});

	it("uses form timezone when provided", async () => {
		const formData = createFormData({
			...validFormData,
			timezone: "America/New_York",
		});

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				timezone: "America/New_York",
			}),
		);
	});

	it("ignores per-date location exceeding 200 chars", async () => {
		const formData = createFormData(validFormData);
		formData.append("location-2026-03-15", "A".repeat(201));

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		// The long location should be ignored (undefined), not passed through
		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				dates: expect.arrayContaining([
					expect.objectContaining({
						date: "2026-03-15",
						location: undefined,
					}),
				]),
			}),
		);
	});
});

describe("default time constants", () => {
	it("DEFAULT_START_TIME is 19:00 (7 PM)", () => {
		expect(DEFAULT_START_TIME).toBe("19:00");
	});

	it("DEFAULT_END_TIME is 21:00 (9 PM)", () => {
		expect(DEFAULT_END_TIME).toBe("21:00");
	});

	it("default times are valid HH:MM format", () => {
		expect(DEFAULT_START_TIME).toMatch(/^\d{2}:\d{2}$/);
		expect(DEFAULT_END_TIME).toMatch(/^\d{2}:\d{2}$/);
	});

	it("default end time is after default start time", () => {
		expect(DEFAULT_END_TIME > DEFAULT_START_TIME).toBe(true);
	});
});

describe("batch action with default times (fast path)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "req-1",
			groupId: "g1",
			title: "March Schedule",
			status: "open",
			requestedDates: ["2026-03-15", "2026-03-16"],
		});
		(createEventsFromAvailability as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: "ev-1",
				groupId: "g1",
				title: "Rehearsal",
				eventType: "rehearsal",
				startTime: new Date("2026-03-15T19:00:00Z"),
				endTime: new Date("2026-03-15T21:00:00Z"),
				location: null,
				description: null,
			},
		]);
	});

	it("succeeds with default time values and title only (fast path)", async () => {
		const formData = createFormData({
			title: "Weekly Rehearsal",
			eventType: "rehearsal",
			startTime: DEFAULT_START_TIME,
			endTime: DEFAULT_END_TIME,
			dates: "2026-03-15,2026-03-16",
		});

		let response: Response | undefined;
		try {
			const result = await action(actionArgs(formData));
			if (result instanceof Response) response = result;
		} catch (thrown) {
			if (thrown instanceof Response) response = thrown;
		}

		expect(response).toBeInstanceOf(Response);
		expect(response?.status).toBe(302);
	});

	it("works without description or locations (minimal form)", async () => {
		const formData = createFormData({
			title: "Quick Rehearsal",
			eventType: "rehearsal",
			startTime: DEFAULT_START_TIME,
			endTime: DEFAULT_END_TIME,
			dates: "2026-03-15",
		});

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Quick Rehearsal",
				description: undefined,
				dates: expect.arrayContaining([
					expect.objectContaining({
						date: "2026-03-15",
						location: undefined,
					}),
				]),
			}),
		);
	});
});

describe("batch action call time (show events)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "req-1",
			groupId: "g1",
			title: "March Schedule",
			status: "open",
			requestedDates: ["2026-03-15", "2026-03-16"],
		});
		(createEventsFromAvailability as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: "ev-1",
				groupId: "g1",
				title: "Big Show",
				eventType: "show",
				startTime: new Date("2026-03-15T19:00:00Z"),
				endTime: new Date("2026-03-15T21:00:00Z"),
				location: null,
				description: null,
			},
		]);
	});

	it("returns error when call time is after start time", async () => {
		const formData = createFormData({
			...validFormData,
			eventType: "show",
			callTime: "20:00",
		});
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "Call time must be before start time." });
	});

	it("returns error when call time equals start time", async () => {
		const formData = createFormData({
			...validFormData,
			eventType: "show",
			callTime: "19:00",
		});
		const result = await action(actionArgs(formData));

		expect(result).toEqual({ error: "Call time must be before start time." });
	});

	it("accepts call time before start time for shows", async () => {
		const formData = createFormData({
			...validFormData,
			eventType: "show",
			callTime: "18:00",
		});

		let response: Response | undefined;
		try {
			const result = await action(actionArgs(formData));
			if (result instanceof Response) response = result;
		} catch (thrown) {
			if (thrown instanceof Response) response = thrown;
		}

		expect(response).toBeInstanceOf(Response);
		expect(response?.status).toBe(302);
	});

	it("passes call time to createEventsFromAvailability for shows", async () => {
		const formData = createFormData({
			...validFormData,
			eventType: "show",
			callTime: "18:00",
		});

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "show",
				callTime: "18:00",
			}),
		);
	});

	it("ignores call time for non-show event types", async () => {
		const formData = createFormData({
			...validFormData,
			eventType: "rehearsal",
			callTime: "18:00",
		});

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "rehearsal",
				callTime: undefined,
			}),
		);
	});

	it("does not pass call time when empty string for shows", async () => {
		const formData = createFormData({
			...validFormData,
			eventType: "show",
			callTime: "",
		});

		try {
			await action(actionArgs(formData));
		} catch {
			// redirect expected
		}

		expect(createEventsFromAvailability).toHaveBeenCalledWith(
			expect.objectContaining({
				eventType: "show",
				callTime: undefined,
			}),
		);
	});
});
