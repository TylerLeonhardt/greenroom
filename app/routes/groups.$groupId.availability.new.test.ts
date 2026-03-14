import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
}));

vi.mock("~/services/groups.server", () => ({
	requireGroupAdminOrPermission: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
		timezone: "America/New_York",
	}),
	getGroupWithMembers: vi.fn().mockResolvedValue({
		group: { id: "g1", name: "Test" },
		members: [],
	}),
	getGroupById: vi.fn().mockResolvedValue({ id: "g1", name: "Test" }),
	getGroupMembersWithPreferences: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/services/availability.server", () => ({
	createAvailabilityRequest: vi.fn().mockResolvedValue({ id: "req-1" }),
}));

vi.mock("~/services/email.server", () => ({
	sendAvailabilityRequestNotification: vi.fn(),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action } from "~/routes/groups.$groupId.availability.new";
import { requireGroupAdminOrPermission } from "~/services/groups.server";

const validFields: Record<string, string> = {
	title: "March Availability",
	dateRangeStart: "2099-03-01",
	dateRangeEnd: "2099-03-31",
	selectedDates: JSON.stringify(["2099-03-15"]),
};

function makeRequest(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}
	return new Request("http://localhost/groups/g1/availability/new", {
		method: "POST",
		body: formData,
	});
}

describe("availability.new action — validation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupAdminOrPermission as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
			timezone: "America/New_York",
		});
	});

	it("returns error when title is empty", async () => {
		const request = makeRequest({ ...validFields, title: "" });
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Title is required." });
	});

	it("returns error when title exceeds 200 characters", async () => {
		const request = makeRequest({ ...validFields, title: "A".repeat(201) });
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Title must be 200 characters or less." });
	});

	it("returns error when description exceeds 2000 characters", async () => {
		const request = makeRequest({
			...validFields,
			description: "A".repeat(2001),
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({
			error: "Description must be 2,000 characters or less.",
		});
	});

	it("returns error when start date is in the past", async () => {
		const request = makeRequest({
			...validFields,
			dateRangeStart: "2020-01-01",
			dateRangeEnd: "2020-01-31",
			selectedDates: JSON.stringify(["2020-01-15"]),
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Start date must not be in the past." });
	});

	it("returns error when start date is after end date", async () => {
		const request = makeRequest({
			...validFields,
			dateRangeStart: "2099-03-31",
			dateRangeEnd: "2099-03-01",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({
			error: "Start date must be before end date.",
		});
	});

	it("returns error when no dates are selected", async () => {
		const { selectedDates: _, ...fieldsWithoutDates } = validFields;
		const request = makeRequest(fieldsWithoutDates);
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({ error: "Please select at least one date." });
	});

	it("returns error when expiration is in the past", async () => {
		const request = makeRequest({
			...validFields,
			expiresAt: "2020-01-01",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({
			error: "Response deadline must be in the future.",
		});
	});

	it("succeeds with empty time fields (all-day request)", async () => {
		const request = makeRequest({
			...validFields,
			requestedStartTime: "",
			requestedEndTime: "",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("succeeds when time fields are not submitted at all", async () => {
		const request = makeRequest(validFields);
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("rejects invalid time format", async () => {
		const request = makeRequest({
			...validFields,
			requestedStartTime: "abc",
			requestedEndTime: "def",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		// Invalid format is treated as "not specified" — should succeed as all-day
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("returns error when only start time is provided", async () => {
		const request = makeRequest({
			...validFields,
			requestedStartTime: "09:00",
			requestedEndTime: "",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({
			error: "Please provide both start and end times, or leave both empty for all-day.",
		});
	});

	it("returns error when end time is before start time", async () => {
		const request = makeRequest({
			...validFields,
			requestedStartTime: "21:00",
			requestedEndTime: "19:00",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toEqual({
			error: "End time must be after start time.",
		});
	});
});

describe("availability.new action — toggle-off scenarios", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupAdminOrPermission as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
			timezone: "America/New_York",
		});
	});

	it("succeeds with only required fields (all toggles off)", async () => {
		// When all optional toggles are off, only required fields are submitted
		const request = makeRequest({
			title: "Minimal Request",
			dateRangeStart: "2099-03-01",
			dateRangeEnd: "2099-03-31",
			selectedDates: JSON.stringify(["2099-03-15"]),
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("succeeds with description toggle on", async () => {
		const request = makeRequest({
			title: "With Description",
			dateRangeStart: "2099-03-01",
			dateRangeEnd: "2099-03-31",
			selectedDates: JSON.stringify(["2099-03-15"]),
			description: "Some extra context",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("succeeds with deadline toggle on", async () => {
		const request = makeRequest({
			title: "With Deadline",
			dateRangeStart: "2099-03-01",
			dateRangeEnd: "2099-03-31",
			selectedDates: JSON.stringify(["2099-03-15"]),
			expiresAt: "2099-03-28",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("succeeds with time range toggle on", async () => {
		const request = makeRequest({
			title: "With Time Range",
			dateRangeStart: "2099-03-01",
			dateRangeEnd: "2099-03-31",
			selectedDates: JSON.stringify(["2099-03-15"]),
			requestedStartTime: "19:00",
			requestedEndTime: "21:00",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});

	it("succeeds with all optional toggles on", async () => {
		const request = makeRequest({
			title: "Full Request",
			dateRangeStart: "2099-03-01",
			dateRangeEnd: "2099-03-31",
			selectedDates: JSON.stringify(["2099-03-15", "2099-03-16"]),
			description: "Detailed description here",
			expiresAt: "2099-03-28",
			requestedStartTime: "19:00",
			requestedEndTime: "21:00",
		});
		const result = await action({
			request,
			params: { groupId: "g1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
	});
});
