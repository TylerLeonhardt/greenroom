import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

function txChainMock(resolved: unknown) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.limit = vi.fn().mockResolvedValue(resolved);
	chain.orderBy = vi.fn().mockReturnValue(chain);
	chain.innerJoin = vi.fn().mockReturnValue(chain);
	chain.leftJoin = vi.fn().mockReturnValue(chain);
	chain.where = vi.fn().mockReturnValue(chain);
	chain.from = vi.fn().mockReturnValue(chain);
	return chain;
}

const mockTransaction = vi.fn();

vi.mock("../../src/db/index.js", () => ({
	db: {
		transaction: mockTransaction,
	},
}));

const mockSendEventReminderNotification = vi.fn();
const mockSendConfirmationReminderNotification = vi.fn();
vi.mock("./email.server.js", () => ({
	sendEventReminderNotification: mockSendEventReminderNotification,
	sendConfirmationReminderNotification: mockSendConfirmationReminderNotification,
}));

const mockSendEventReminderWebhook = vi.fn();
vi.mock("./webhook.server.js", () => ({
	sendEventReminderWebhook: mockSendEventReminderWebhook,
}));

vi.mock("./logger.server.js", () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

const mockTrackEvent = vi.fn();
vi.mock("./telemetry.server.js", () => ({
	trackEvent: mockTrackEvent,
}));

vi.mock("../lib/date-utils.js", () => ({
	formatEventTime: vi.fn(() => "Sun, Mar 1 · 7:00 PM – 9:00 PM"),
	formatTime: vi.fn(() => "6:00 PM"),
	getTimezoneAbbreviation: vi.fn(() => "PST"),
}));

const { processReminders, processConfirmationReminders, startReminderJob } = await import(
	"~/services/reminder.server"
);

// --- Test data ---

const eventStart = new Date("2026-03-02T02:00:00Z"); // ~8 hours from "now"
const eventEnd = new Date("2026-03-02T04:00:00Z");

const mockUpcomingEvent = {
	id: "event-1",
	groupId: "group-1",
	title: "Show Night",
	eventType: "show",
	startTime: eventStart,
	endTime: eventEnd,
	location: "Theater",
	callTime: new Date("2026-03-02T01:00:00Z"),
	groupName: "Comedy Team",
	creatorTimezone: "America/Los_Angeles",
	webhookUrl: "https://discord.com/api/webhooks/123/abc",
};

const mockAttendees = [
	{
		userId: "user-1",
		email: "alice@example.com",
		name: "Alice",
		notificationPreferences: {
			availabilityRequests: { email: true },
			eventNotifications: { email: true },
			showReminders: { email: true },
		},
	},
	{
		userId: "user-2",
		email: "bob@example.com",
		name: "Bob",
		notificationPreferences: {
			availabilityRequests: { email: true },
			eventNotifications: { email: true },
			showReminders: { email: false },
		},
	},
];

const mockPendingAttendees = [
	{
		userId: "user-3",
		email: "charlie@example.com",
		name: "Charlie",
		timezone: "America/New_York",
		notificationPreferences: {
			availabilityRequests: { email: true },
			eventNotifications: { email: true },
			showReminders: { email: true },
		},
	},
	{
		userId: "user-4",
		email: "diana@example.com",
		name: "Diana",
		timezone: "Europe/London",
		notificationPreferences: {
			availabilityRequests: { email: true },
			eventNotifications: { email: true },
			showReminders: { email: false },
		},
	},
];

describe("reminder.server", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.ENABLE_REMINDERS;
		process.env.APP_URL = "https://mycalltime.app";
	});

	describe("startReminderJob", () => {
		it("does not start when ENABLE_REMINDERS is not 'true'", () => {
			startReminderJob();
			// Should not throw and not start cron (no transaction calls)
			expect(mockTransaction).not.toHaveBeenCalled();
		});
	});

	describe("processReminders", () => {
		it("skips processing when advisory lock is held by another instance", async () => {
			mockTransaction.mockImplementation(async (fn) => {
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: false }],
					}),
					select: vi.fn(),
				};
				return fn(tx);
			});

			await processReminders();

			// Should not attempt to send emails
			expect(mockSendEventReminderNotification).not.toHaveBeenCalled();
		});

		it("processes events and sends reminders to confirmed attendees", async () => {
			mockTransaction.mockImplementation(async (fn) => {
				// Build event query chain
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([mockUpcomingEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				// Build attendee query chain
				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue(mockAttendees);
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(undefined),
						}),
					}),
				};
				return fn(tx);
			});

			await processReminders();

			// Should send reminders (preference filtering happens in email.server.ts)
			expect(mockSendEventReminderNotification).toHaveBeenCalledTimes(2);
			expect(mockSendEventReminderNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					eventTitle: "Show Night",
					eventType: "show",
					groupName: "Comedy Team",
					recipient: expect.objectContaining({ email: "alice@example.com" }),
				}),
			);
		});

		it("does not send reminders when no upcoming events need them", async () => {
			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([]); // No events
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockReturnValue(eventChain),
				};
				return fn(tx);
			});

			await processReminders();

			expect(mockSendEventReminderNotification).not.toHaveBeenCalled();
		});

		it("marks event as reminder sent after processing", async () => {
			const mockUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
			const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateSetWhere });
			const mockTxUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([mockUpcomingEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue([mockAttendees[0]]);
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: mockTxUpdateFn,
				};
				return fn(tx);
			});

			await processReminders();

			// Verify update was called to mark reminderSentAt
			expect(mockTxUpdateFn).toHaveBeenCalled();
			expect(mockUpdateSet).toHaveBeenCalledWith(
				expect.objectContaining({ reminderSentAt: expect.any(Date) }),
			);
		});

		it("handles events with no confirmed attendees gracefully", async () => {
			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([mockUpcomingEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue([]); // No attendees
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(undefined),
						}),
					}),
				};
				return fn(tx);
			});

			await processReminders();

			// Should still mark as sent even with no attendees (to avoid retrying)
			expect(mockSendEventReminderNotification).not.toHaveBeenCalled();
		});

		it("sends Discord webhook with creator's timezone", async () => {
			const { formatEventTime, getTimezoneAbbreviation } = await import("../lib/date-utils.js");

			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([mockUpcomingEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue(mockAttendees);
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(undefined),
						}),
					}),
				};
				return fn(tx);
			});

			await processReminders();

			// Verify webhook was called with timezone-formatted dateTime
			expect(mockSendEventReminderWebhook).toHaveBeenCalledWith(
				"https://discord.com/api/webhooks/123/abc",
				expect.objectContaining({
					groupName: "Comedy Team",
					eventTitle: "Show Night",
					dateTime: expect.stringContaining("PST"),
				}),
			);

			// Verify formatEventTime was called with the creator's timezone
			expect(formatEventTime).toHaveBeenCalledWith(
				mockUpcomingEvent.startTime,
				mockUpcomingEvent.endTime,
				"America/Los_Angeles",
			);

			// Verify getTimezoneAbbreviation was called with the creator's timezone
			expect(getTimezoneAbbreviation).toHaveBeenCalledWith(
				mockUpcomingEvent.startTime,
				"America/Los_Angeles",
			);
		});

		it("falls back to first attendee's timezone when creator is deleted", async () => {
			const { formatEventTime } = await import("../lib/date-utils.js");
			const eventWithoutCreator = {
				...mockUpcomingEvent,
				creatorTimezone: null,
			};
			const attendeesWithTimezone = [
				{ ...mockAttendees[0], timezone: "America/New_York" },
				{ ...mockAttendees[1], timezone: "America/Chicago" },
			];

			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([eventWithoutCreator]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue(attendeesWithTimezone);
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(undefined),
						}),
					}),
				};
				return fn(tx);
			});

			await processReminders();

			// Should fall back to first attendee's timezone
			expect(formatEventTime).toHaveBeenCalledWith(
				eventWithoutCreator.startTime,
				eventWithoutCreator.endTime,
				"America/New_York",
			);
		});
	});

	describe("processConfirmationReminders", () => {
		it("skips processing when advisory lock is held by another instance", async () => {
			mockTransaction.mockImplementation(async (fn) => {
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: false }],
					}),
					select: vi.fn(),
				};
				return fn(tx);
			});

			await processConfirmationReminders();

			expect(mockSendConfirmationReminderNotification).not.toHaveBeenCalled();
		});

		it("sends confirmation reminders only to pending attendees", async () => {
			const confirmationEvent = {
				id: "event-2",
				groupId: "group-1",
				title: "Friday Rehearsal",
				eventType: "rehearsal",
				startTime: new Date("2026-03-04T02:00:00Z"),
				endTime: new Date("2026-03-04T04:00:00Z"),
				location: "Studio B",
				groupName: "Comedy Team",
			};

			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([confirmationEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue(mockPendingAttendees);
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(undefined),
						}),
					}),
				};
				return fn(tx);
			});

			await processConfirmationReminders();

			expect(mockSendConfirmationReminderNotification).toHaveBeenCalledTimes(2);
			expect(mockSendConfirmationReminderNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					eventTitle: "Friday Rehearsal",
					eventType: "rehearsal",
					groupName: "Comedy Team",
					location: "Studio B",
					recipient: expect.objectContaining({
						email: "charlie@example.com",
						name: "Charlie",
					}),
					eventUrl: "https://mycalltime.app/groups/group-1/events/event-2",
					preferencesUrl: "https://mycalltime.app/groups/group-1/notifications",
				}),
			);
		});

		it("does not send when no events need confirmation reminders", async () => {
			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockReturnValue(eventChain),
				};
				return fn(tx);
			});

			await processConfirmationReminders();

			expect(mockSendConfirmationReminderNotification).not.toHaveBeenCalled();
		});

		it("marks event as confirmation reminder sent after processing", async () => {
			const mockUpdateSetWhere = vi.fn().mockResolvedValue(undefined);
			const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateSetWhere });
			const mockTxUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

			const confirmationEvent = {
				id: "event-3",
				groupId: "group-2",
				title: "Show",
				eventType: "show",
				startTime: new Date("2026-03-04T02:00:00Z"),
				endTime: new Date("2026-03-04T04:00:00Z"),
				location: null,
				groupName: "Improv Group",
			};

			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([confirmationEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue([mockPendingAttendees[0]]);
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: mockTxUpdateFn,
				};
				return fn(tx);
			});

			await processConfirmationReminders();

			expect(mockTxUpdateFn).toHaveBeenCalled();
			expect(mockUpdateSet).toHaveBeenCalledWith(
				expect.objectContaining({ confirmationReminderSentAt: expect.any(Date) }),
			);
		});

		it("tracks telemetry event after sending confirmation reminders", async () => {
			const confirmationEvent = {
				id: "event-4",
				groupId: "group-1",
				title: "Weekly Practice",
				eventType: "rehearsal",
				startTime: new Date("2026-03-04T02:00:00Z"),
				endTime: new Date("2026-03-04T04:00:00Z"),
				location: null,
				groupName: "Comedy Team",
			};

			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([confirmationEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue([mockPendingAttendees[0]]);
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(undefined),
						}),
					}),
				};
				return fn(tx);
			});

			await processConfirmationReminders();

			expect(mockTrackEvent).toHaveBeenCalledWith("ConfirmationReminderSent", {
				groupId: "group-1",
				eventId: "event-4",
				pendingAttendeeCount: "1",
			});
		});

		it("handles events with no pending attendees gracefully", async () => {
			const confirmationEvent = {
				id: "event-5",
				groupId: "group-1",
				title: "All Confirmed",
				eventType: "rehearsal",
				startTime: new Date("2026-03-04T02:00:00Z"),
				endTime: new Date("2026-03-04T04:00:00Z"),
				location: null,
				groupName: "Comedy Team",
			};

			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([confirmationEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue([]); // No pending attendees
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(undefined),
						}),
					}),
				};
				return fn(tx);
			});

			await processConfirmationReminders();

			// Should still mark as sent even with no pending attendees (to avoid retrying)
			expect(mockSendConfirmationReminderNotification).not.toHaveBeenCalled();
		});

		it("passes attendee timezone for time formatting", async () => {
			const { formatEventTime } = await import("../lib/date-utils.js");

			const confirmationEvent = {
				id: "event-6",
				groupId: "group-1",
				title: "Timezone Test",
				eventType: "other",
				startTime: new Date("2026-03-04T02:00:00Z"),
				endTime: new Date("2026-03-04T04:00:00Z"),
				location: null,
				groupName: "Comedy Team",
			};

			const singleAttendee = [
				{
					userId: "user-5",
					email: "eve@example.com",
					name: "Eve",
					timezone: "America/Los_Angeles",
					notificationPreferences: {
						availabilityRequests: { email: true },
						eventNotifications: { email: true },
						showReminders: { email: true },
					},
				},
			];

			mockTransaction.mockImplementation(async (fn) => {
				const eventChain = txChainMock(null);
				eventChain.where = vi.fn().mockResolvedValue([confirmationEvent]);
				eventChain.innerJoin = vi.fn().mockReturnValue(eventChain);
				eventChain.from = vi.fn().mockReturnValue(eventChain);

				const attendeeChain = txChainMock(null);
				attendeeChain.where = vi.fn().mockResolvedValue(singleAttendee);
				attendeeChain.innerJoin = vi.fn().mockReturnValue(attendeeChain);
				attendeeChain.from = vi.fn().mockReturnValue(attendeeChain);

				let selectCallCount = 0;
				const tx = {
					execute: vi.fn().mockResolvedValue({
						rows: [{ pg_try_advisory_xact_lock: true }],
					}),
					select: vi.fn().mockImplementation(() => {
						selectCallCount++;
						return selectCallCount === 1 ? eventChain : attendeeChain;
					}),
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(undefined),
						}),
					}),
				};
				return fn(tx);
			});

			await processConfirmationReminders();

			// Verify formatEventTime was called with the attendee's timezone
			expect(formatEventTime).toHaveBeenCalledWith(
				confirmationEvent.startTime,
				confirmationEvent.endTime,
				"America/Los_Angeles",
			);
		});
	});
});
