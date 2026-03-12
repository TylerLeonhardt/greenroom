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

// Mock availability service
vi.mock("~/services/availability.server", () => ({
	getAvailabilityRequest: vi.fn(),
	updateAvailabilityRequest: vi.fn(),
}));

// Mock CSRF validation
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock email service
vi.mock("~/services/email.server", () => ({
	sendAvailabilityRequestEditedNotification: vi.fn(),
}));

// Mock webhook service
vi.mock("~/services/webhook.server", () => ({
	sendAvailabilityRequestEditedWebhook: vi.fn(),
}));

import { action } from "~/routes/groups.$groupId.availability.$requestId.edit";
import { getAvailabilityRequest, updateAvailabilityRequest } from "~/services/availability.server";
import { isGroupAdmin, requireGroupMember } from "~/services/groups.server";

const defaultRequest = {
	id: "req-1",
	groupId: "g1",
	title: "March Availability",
	description: null,
	dateRangeStart: new Date("2026-03-01"),
	dateRangeEnd: new Date("2026-03-31"),
	requestedDates: ["2026-03-15", "2026-03-16", "2026-03-17"],
	requestedStartTime: null,
	requestedEndTime: null,
	status: "open" as const,
	createdById: "user-1",
	createdByName: "Test User",
	createdAt: new Date(),
	expiresAt: null,
};

describe("availability edit action — IDOR prevention", () => {
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

	it("returns 404 when request belongs to different group", async () => {
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			...defaultRequest,
			groupId: "other-group",
		});

		const formData = new FormData();
		formData.set("title", "Hack");
		formData.set("selectedDates", '["2026-03-15"]');

		const request = new Request("http://localhost/groups/g1/availability/req-1/edit", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", requestId: "req-1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}

		expect(updateAvailabilityRequest).not.toHaveBeenCalled();
	});

	it("returns 404 when request does not exist", async () => {
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const formData = new FormData();
		formData.set("title", "Hack");
		formData.set("selectedDates", '["2026-03-15"]');

		const request = new Request("http://localhost/groups/g1/availability/req-1/edit", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", requestId: "req-1" },
				context: {},
			});
			expect.fail("Should have thrown 404");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(404);
		}
	});
});

describe("availability edit action — permissions", () => {
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
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			...defaultRequest,
			createdById: "user-1",
		});

		const formData = new FormData();
		formData.set("title", "Hack");
		formData.set("selectedDates", '["2026-03-15"]');

		const request = new Request("http://localhost/groups/g1/availability/req-1/edit", {
			method: "POST",
			body: formData,
		});

		try {
			await action({
				request,
				params: { groupId: "g1", requestId: "req-1" },
				context: {},
			});
			expect.fail("Should have thrown 403");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(403);
		}

		expect(updateAvailabilityRequest).not.toHaveBeenCalled();
	});

	it("allows creator (non-admin) to edit their own request", async () => {
		(isGroupAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			...defaultRequest,
			createdById: "user-2",
		});

		const formData = new FormData();
		formData.set("title", "Updated Title");
		formData.set("selectedDates", '["2026-03-15", "2026-03-16"]');

		const request = new Request("http://localhost/groups/g1/availability/req-1/edit", {
			method: "POST",
			body: formData,
		});

		const result = await action({
			request,
			params: { groupId: "g1", requestId: "req-1" },
			context: {},
		});

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect(updateAvailabilityRequest).toHaveBeenCalled();
	});
});

describe("availability edit action — validation", () => {
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
		(getAvailabilityRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
			...defaultRequest,
		});
	});

	function makeRequest(fields: Record<string, string>) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(fields)) {
			formData.set(key, value);
		}
		return new Request("http://localhost/groups/g1/availability/req-1/edit", {
			method: "POST",
			body: formData,
		});
	}

	it("returns error when title is empty", async () => {
		const result = await action({
			request: makeRequest({ title: "", selectedDates: '["2026-03-15"]' }),
			params: { groupId: "g1", requestId: "req-1" },
			context: {},
		});
		expect(result).toEqual({ error: "Title is required." });
	});

	it("returns error when title exceeds 200 characters", async () => {
		const result = await action({
			request: makeRequest({ title: "A".repeat(201), selectedDates: '["2026-03-15"]' }),
			params: { groupId: "g1", requestId: "req-1" },
			context: {},
		});
		expect(result).toEqual({ error: "Title must be 200 characters or less." });
	});

	it("returns error when no dates selected", async () => {
		const result = await action({
			request: makeRequest({ title: "Valid", selectedDates: "[]" }),
			params: { groupId: "g1", requestId: "req-1" },
			context: {},
		});
		expect(result).toEqual({ error: "Please select at least one date." });
	});

	it("returns error when dates have invalid format", async () => {
		const result = await action({
			request: makeRequest({ title: "Valid", selectedDates: '["not-a-date"]' }),
			params: { groupId: "g1", requestId: "req-1" },
			context: {},
		});
		expect(result).toEqual({ error: "Invalid date format." });
	});

	it("redirects without updating when nothing changed", async () => {
		const result = await action({
			request: makeRequest({
				title: defaultRequest.title,
				selectedDates: JSON.stringify(defaultRequest.requestedDates),
			}),
			params: { groupId: "g1", requestId: "req-1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect(updateAvailabilityRequest).not.toHaveBeenCalled();
	});

	it("allows valid update", async () => {
		const result = await action({
			request: makeRequest({
				title: "New Title",
				selectedDates: '["2026-03-15", "2026-03-18"]',
			}),
			params: { groupId: "g1", requestId: "req-1" },
			context: {},
		});
		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(302);
		expect(updateAvailabilityRequest).toHaveBeenCalled();
	});
});
