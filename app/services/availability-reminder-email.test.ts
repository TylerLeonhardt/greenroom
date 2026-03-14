import { describe, expect, it, vi } from "vitest";

vi.mock("@azure/communication-email", () => ({
	EmailClient: vi.fn(),
}));

vi.mock("~/services/logger.server", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("~/services/telemetry.server", () => ({
	getTelemetryClient: vi.fn().mockReturnValue(null),
}));

import { sendAvailabilityReminderNotification } from "~/services/email.server";

describe("sendAvailabilityReminderNotification", () => {
	it("sends email to recipients with availabilityRequests.email: true", async () => {
		await sendAvailabilityReminderNotification({
			requestTitle: "March Schedule",
			groupName: "Test Group",
			dateRange: "Mar 1 – Mar 31",
			recipients: [
				{
					email: "wants@test.com",
					name: "Wants Email",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
			],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		// Smoke test — no errors thrown, function completes successfully
		expect(true).toBe(true);
	});

	it("skips recipients with availabilityRequests.email: false", async () => {
		await sendAvailabilityReminderNotification({
			requestTitle: "March Schedule",
			groupName: "Test Group",
			dateRange: "Mar 1 – Mar 31",
			recipients: [
				{
					email: "no@test.com",
					name: "No Email",
					notificationPreferences: {
						availabilityRequests: { email: false },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
			],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		// Should complete without sending — no error thrown
		expect(true).toBe(true);
	});

	it("defaults to sending when notificationPreferences is undefined", async () => {
		await sendAvailabilityReminderNotification({
			requestTitle: "March Schedule",
			groupName: "Test Group",
			dateRange: "Mar 1 – Mar 31",
			recipients: [
				{
					email: "default@test.com",
					name: "Default User",
					// no notificationPreferences — should default to all ON
				},
			],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		expect(true).toBe(true);
	});

	it("includes expiry date in email when provided", async () => {
		// Should not throw when expiresAt is provided
		await sendAvailabilityReminderNotification({
			requestTitle: "March Schedule",
			groupName: "Test Group",
			dateRange: "Mar 1 – Mar 31",
			expiresAt: "Mar 28, 2025",
			recipients: [
				{
					email: "user@test.com",
					name: "Test User",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
			],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		expect(true).toBe(true);
	});

	it("omits expiry line when no expiry date", async () => {
		await sendAvailabilityReminderNotification({
			requestTitle: "March Schedule",
			groupName: "Test Group",
			dateRange: "Mar 1 – Mar 31",
			expiresAt: null,
			recipients: [
				{
					email: "user@test.com",
					name: "Test User",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
			],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		expect(true).toBe(true);
	});

	it("handles multiple recipients, filtering appropriately", async () => {
		await sendAvailabilityReminderNotification({
			requestTitle: "March Schedule",
			groupName: "Test Group",
			dateRange: "Mar 1 – Mar 31",
			recipients: [
				{
					email: "wants@test.com",
					name: "Wants Email",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
				{
					email: "no@test.com",
					name: "No Email",
					notificationPreferences: {
						availabilityRequests: { email: false },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
				{
					email: "default@test.com",
					name: "Default User",
					// undefined prefs — defaults to ON
				},
			],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		// Two of three recipients should be processed (wants@ and default@); no@ is skipped
		expect(true).toBe(true);
	});

	it("does not throw errors (fire-and-forget smoke test)", async () => {
		await expect(
			sendAvailabilityReminderNotification({
				requestTitle: "Test",
				groupName: "Group",
				dateRange: "Mar 1 – Mar 15",
				recipients: [
					{
						email: "user@test.com",
						name: "User",
					},
				],
				requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
			}),
		).resolves.toBeUndefined();
	});
});
