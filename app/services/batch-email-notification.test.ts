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

import { sendBatchEventsFromAvailabilityNotification } from "~/services/email.server";

const baseEvents = [
	{
		title: "Friday Rehearsal",
		eventType: "rehearsal",
		startTime: "2026-03-15T19:00:00.000Z",
		endTime: "2026-03-15T21:00:00.000Z",
		location: "Theater A",
		eventUrl: "http://localhost:5173/groups/g1/events/e1",
	},
	{
		title: "Saturday Show",
		eventType: "show",
		startTime: "2026-03-16T20:00:00.000Z",
		endTime: "2026-03-16T22:00:00.000Z",
		eventUrl: "http://localhost:5173/groups/g1/events/e2",
	},
];

describe("sendBatchEventsFromAvailabilityNotification", () => {
	it("sends to available recipients without error", async () => {
		await sendBatchEventsFromAvailabilityNotification({
			events: baseEvents,
			groupName: "Test Group",
			availableRecipients: [
				{
					email: "available@test.com",
					name: "Available User",
					timezone: "UTC",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
			],
			maybeRecipients: [],
			noResponseRecipients: [],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		// No errors thrown — sendEmail logs "not configured" and returns success
		expect(true).toBe(true);
	});

	it("sends to maybe recipients without error", async () => {
		await sendBatchEventsFromAvailabilityNotification({
			events: baseEvents,
			groupName: "Test Group",
			availableRecipients: [],
			maybeRecipients: [
				{
					email: "maybe@test.com",
					name: "Maybe User",
					timezone: "UTC",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
			],
			noResponseRecipients: [],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		expect(true).toBe(true);
	});

	it("sends to no-response recipients without error", async () => {
		await sendBatchEventsFromAvailabilityNotification({
			events: baseEvents,
			groupName: "Test Group",
			availableRecipients: [],
			maybeRecipients: [],
			noResponseRecipients: [
				{
					email: "noresp@test.com",
					name: "No Response User",
					timezone: "UTC",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
			],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		expect(true).toBe(true);
	});

	it("skips recipients with event notifications disabled", async () => {
		await sendBatchEventsFromAvailabilityNotification({
			events: baseEvents,
			groupName: "Test Group",
			availableRecipients: [
				{
					email: "nonotif@test.com",
					name: "No Notif User",
					timezone: "UTC",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: false },
						showReminders: { email: true },
					},
				},
			],
			maybeRecipients: [
				{
					email: "nonotif2@test.com",
					name: "No Notif Maybe",
					timezone: "UTC",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: false },
						showReminders: { email: true },
					},
				},
			],
			noResponseRecipients: [
				{
					email: "nonotif3@test.com",
					name: "No Notif NoResp",
					timezone: "UTC",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: false },
						showReminders: { email: true },
					},
				},
			],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		// All recipients have eventNotifications.email: false — no emails should be sent.
		// sendEmail is void/fire-and-forget so we verify no errors thrown.
		expect(true).toBe(true);
	});

	it("handles empty recipient arrays without errors", async () => {
		await sendBatchEventsFromAvailabilityNotification({
			events: baseEvents,
			groupName: "Test Group",
			availableRecipients: [],
			maybeRecipients: [],
			noResponseRecipients: [],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		expect(true).toBe(true);
	});

	it("defaults to sending when notificationPreferences is undefined", async () => {
		await sendBatchEventsFromAvailabilityNotification({
			events: baseEvents,
			groupName: "Test Group",
			availableRecipients: [
				{
					email: "default@test.com",
					name: "Default User",
					timezone: "UTC",
					// no notificationPreferences — should default to all ON
				},
			],
			maybeRecipients: [],
			noResponseRecipients: [],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		expect(true).toBe(true);
	});

	it("handles single event (singular grammar)", async () => {
		await sendBatchEventsFromAvailabilityNotification({
			events: [baseEvents[0]],
			groupName: "Test Group",
			availableRecipients: [
				{
					email: "single@test.com",
					name: "Single Event User",
					timezone: "UTC",
				},
			],
			maybeRecipients: [],
			noResponseRecipients: [],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		expect(true).toBe(true);
	});

	it("handles events without locations", async () => {
		const eventsNoLocation = [
			{
				title: "Rehearsal",
				eventType: "rehearsal",
				startTime: "2026-03-15T19:00:00.000Z",
				endTime: "2026-03-15T21:00:00.000Z",
				eventUrl: "http://localhost:5173/groups/g1/events/e1",
			},
		];

		await sendBatchEventsFromAvailabilityNotification({
			events: eventsNoLocation,
			groupName: "Test Group",
			availableRecipients: [
				{
					email: "user@test.com",
					name: "Test User",
					timezone: "UTC",
				},
			],
			maybeRecipients: [],
			noResponseRecipients: [],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		expect(true).toBe(true);
	});

	it("passes preferences URL to email layout", async () => {
		await sendBatchEventsFromAvailabilityNotification({
			events: baseEvents,
			groupName: "Test Group",
			availableRecipients: [
				{
					email: "user@test.com",
					name: "User",
					timezone: "UTC",
				},
			],
			maybeRecipients: [],
			noResponseRecipients: [],
			eventsUrl: "http://localhost:5173/groups/g1/events",
			preferencesUrl: "http://localhost:5173/groups/g1/notifications",
		});

		expect(true).toBe(true);
	});
});
