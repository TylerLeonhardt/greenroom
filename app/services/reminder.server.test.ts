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
vi.mock("./email.server.js", () => ({
	sendEventReminderNotification: mockSendEventReminderNotification,
}));

vi.mock("./logger.server.js", () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../lib/date-utils.js", () => ({
	formatEventTime: vi.fn(() => "Sun, Mar 1 · 7:00 PM – 9:00 PM"),
	formatTime: vi.fn(() => "6:00 PM"),
}));

const { processReminders, startReminderJob } = await import("~/services/reminder.server");

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
	});
});
