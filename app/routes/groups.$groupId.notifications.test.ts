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
	requireGroupMember: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
	getNotificationPreferences: vi.fn().mockResolvedValue({
		availabilityRequests: { email: true },
		eventNotifications: { email: true },
		showReminders: { email: true },
	}),
	updateNotificationPreferences: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { action } from "~/routes/groups.$groupId.notifications";
import { requireGroupMember, updateNotificationPreferences } from "~/services/groups.server";

function makeRequest(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}
	return new Request("http://localhost/groups/g1/notifications", {
		method: "POST",
		body: formData,
	});
}

describe("notifications action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
	});

	it("updates preferences with all enabled", async () => {
		const request = makeRequest({
			intent: "update-preferences",
			availabilityRequests: "on",
			eventNotifications: "on",
			showReminders: "on",
		});
		const result = await action({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({ success: true, message: "Notification preferences updated." });
		expect(updateNotificationPreferences).toHaveBeenCalledWith("user-1", "g1", {
			availabilityRequests: { email: true },
			eventNotifications: { email: true },
			showReminders: { email: true },
		});
	});

	it("updates preferences with all disabled", async () => {
		const request = makeRequest({
			intent: "update-preferences",
		});
		const result = await action({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({ success: true, message: "Notification preferences updated." });
		expect(updateNotificationPreferences).toHaveBeenCalledWith("user-1", "g1", {
			availabilityRequests: { email: false },
			eventNotifications: { email: false },
			showReminders: { email: false },
		});
	});

	it("updates preferences with mixed settings", async () => {
		const request = makeRequest({
			intent: "update-preferences",
			availabilityRequests: "on",
		});
		const result = await action({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({ success: true, message: "Notification preferences updated." });
		expect(updateNotificationPreferences).toHaveBeenCalledWith("user-1", "g1", {
			availabilityRequests: { email: true },
			eventNotifications: { email: false },
			showReminders: { email: false },
		});
	});

	it("returns error for invalid intent", async () => {
		const request = makeRequest({ intent: "bad-intent" });
		const result = await action({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({ error: "Invalid action.", success: false });
	});

	it("returns error when update fails", async () => {
		(updateNotificationPreferences as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("DB error"),
		);
		const request = makeRequest({
			intent: "update-preferences",
			availabilityRequests: "on",
		});
		const result = await action({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({ error: "Failed to update preferences.", success: false });
	});
});
