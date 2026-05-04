import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth service
vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
		timezone: "America/New_York",
	}),
	updateUserTimezone: vi.fn().mockResolvedValue(undefined),
	updateUserName: vi.fn().mockResolvedValue(undefined),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock calendar token service
vi.mock("~/services/calendar-token.server", () => ({
	getCalendarToken: vi.fn().mockResolvedValue(null),
	regenerateCalendarToken: vi.fn().mockResolvedValue("new-generated-token-hex"),
}));

import { action, loader } from "~/routes/settings";
import { requireUser, updateUserName, updateUserTimezone } from "~/services/auth.server";
import { getCalendarToken, regenerateCalendarToken } from "~/services/calendar-token.server";

function makeFormData(data: Record<string, string>): FormData {
	const formData = new FormData();
	for (const [key, value] of Object.entries(data)) {
		formData.set(key, value);
	}
	return formData;
}

function makeRequest(formData: FormData): Request {
	return new Request("http://localhost/settings", {
		method: "POST",
		body: formData,
	});
}

describe("settings route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
			timezone: "America/New_York",
		});
		(getCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(regenerateCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue(
			"new-generated-token-hex",
		);
	});

	describe("loader", () => {
		it("returns the authenticated user and calendar token", async () => {
			(getCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue("existing-token-abc");
			const request = new Request("http://localhost/settings");
			const result = await loader({ request, params: {}, context: {} });
			expect(result).toEqual({
				user: {
					id: "user-1",
					email: "test@example.com",
					name: "Test User",
					profileImage: null,
					timezone: "America/New_York",
				},
				calendarToken: "existing-token-abc",
				baseUrl: "http://localhost",
			});
		});

		it("returns null calendarToken when user has no token", async () => {
			const request = new Request("http://localhost/settings");
			const result = await loader({ request, params: {}, context: {} });
			expect(result.calendarToken).toBeNull();
		});
	});

	describe("action — update-name", () => {
		it("updates the display name", async () => {
			const formData = makeFormData({ intent: "update-name", name: "New Name" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ success: true, message: "Display name updated!" });
			expect(updateUserName).toHaveBeenCalledWith("user-1", "New Name");
		});

		it("trims whitespace from the name", async () => {
			const formData = makeFormData({ intent: "update-name", name: "  Trimmed Name  " });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ success: true, message: "Display name updated!" });
			expect(updateUserName).toHaveBeenCalledWith("user-1", "Trimmed Name");
		});

		it("rejects empty name", async () => {
			const formData = makeFormData({ intent: "update-name", name: "" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Display name is required." });
			expect(updateUserName).not.toHaveBeenCalled();
		});

		it("rejects whitespace-only name", async () => {
			const formData = makeFormData({ intent: "update-name", name: "   " });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Display name is required." });
			expect(updateUserName).not.toHaveBeenCalled();
		});

		it("rejects name exceeding 100 characters", async () => {
			const longName = "A".repeat(101);
			const formData = makeFormData({ intent: "update-name", name: longName });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Display name must be 100 characters or less." });
			expect(updateUserName).not.toHaveBeenCalled();
		});

		it("accepts name of exactly 100 characters", async () => {
			const exactName = "A".repeat(100);
			const formData = makeFormData({ intent: "update-name", name: exactName });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ success: true, message: "Display name updated!" });
			expect(updateUserName).toHaveBeenCalledWith("user-1", exactName);
		});

		it("rejects missing name field", async () => {
			const formData = makeFormData({ intent: "update-name" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Display name is required." });
			expect(updateUserName).not.toHaveBeenCalled();
		});
	});

	describe("action — update-timezone", () => {
		it("updates the timezone", async () => {
			const formData = makeFormData({
				intent: "update-timezone",
				timezone: "America/Los_Angeles",
			});
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ success: true, message: "Timezone updated!" });
			expect(updateUserTimezone).toHaveBeenCalledWith("user-1", "America/Los_Angeles");
		});

		it("rejects empty timezone", async () => {
			const formData = makeFormData({ intent: "update-timezone", timezone: "" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Timezone is required." });
		});

		it("rejects timezone abbreviations like PST", async () => {
			const formData = makeFormData({ intent: "update-timezone", timezone: "PST" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Invalid timezone. Please select a valid IANA timezone." });
			expect(updateUserTimezone).not.toHaveBeenCalled();
		});

		it("rejects timezone abbreviations like EST", async () => {
			const formData = makeFormData({ intent: "update-timezone", timezone: "EST" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Invalid timezone. Please select a valid IANA timezone." });
			expect(updateUserTimezone).not.toHaveBeenCalled();
		});

		it("rejects timezone abbreviations like CST", async () => {
			const formData = makeFormData({ intent: "update-timezone", timezone: "CST" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Invalid timezone. Please select a valid IANA timezone." });
			expect(updateUserTimezone).not.toHaveBeenCalled();
		});

		it("accepts UTC", async () => {
			const formData = makeFormData({ intent: "update-timezone", timezone: "UTC" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ success: true, message: "Timezone updated!" });
			expect(updateUserTimezone).toHaveBeenCalledWith("user-1", "UTC");
		});
	});

	describe("action — generate-calendar-token", () => {
		it("generates a new calendar token", async () => {
			const formData = makeFormData({ intent: "generate-calendar-token" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({
				success: true,
				message: "Calendar feed URL generated!",
				calendarToken: "new-generated-token-hex",
			});
			expect(regenerateCalendarToken).toHaveBeenCalledWith("user-1");
		});
	});

	describe("action — regenerate-calendar-token", () => {
		it("regenerates the calendar token", async () => {
			const formData = makeFormData({ intent: "regenerate-calendar-token" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({
				success: true,
				message: "Calendar feed URL regenerated! Update the URL in your calendar app.",
				calendarToken: "new-generated-token-hex",
			});
			expect(regenerateCalendarToken).toHaveBeenCalledWith("user-1");
		});
	});

	describe("action — invalid intent", () => {
		it("returns error for unknown intent", async () => {
			const formData = makeFormData({ intent: "unknown" });
			const result = await action({
				request: makeRequest(formData),
				params: {},
				context: {},
			});
			expect(result).toEqual({ error: "Invalid action." });
		});
	});
});
