import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock calendar token service
vi.mock("~/services/calendar-token.server", () => ({
	getUserByCalendarToken: vi.fn(),
}));

// Mock events service
vi.mock("~/services/events.server", () => ({
	getUserCalendarEvents: vi.fn(),
}));

// Mock logger
vi.mock("~/services/logger.server", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

// Mock db
vi.mock("../../src/db/index.js", () => ({
	db: {},
}));

import { getUserByCalendarToken } from "~/services/calendar-token.server";
import { getUserCalendarEvents } from "~/services/events.server";
import { _resetForTests } from "~/services/rate-limit.server";
import { loader } from "./api.calendar.$token";

describe("GET /api/calendar/:token.ics", () => {
	const validHexToken = "aabb1122ccdd3344eeff5566aabb1122";
	const unknownHexToken = "deadbeefdeadbeefdeadbeefdeadbeef";

	beforeEach(() => {
		vi.resetAllMocks();
		_resetForTests();
	});
	const mockEvents = [
		{
			id: "event-1",
			groupId: "group-1",
			title: "Friday Rehearsal",
			description: "Weekly practice",
			eventType: "rehearsal",
			startTime: new Date("2026-03-15T19:00:00Z"),
			endTime: new Date("2026-03-15T21:00:00Z"),
			callTime: null,
			location: "Main Theater",
			timezone: "America/Los_Angeles",
			createdById: "user-1",
			createdFromRequestId: null,
			reminderSentAt: null,
			confirmationReminderSentAt: null,
			createdAt: new Date("2026-03-01T00:00:00Z"),
			updatedAt: new Date("2026-03-10T12:00:00Z"),
			groupName: "Team Alpha",
			userRole: null,
		},
		{
			id: "event-2",
			groupId: "group-2",
			title: "Saturday Show",
			description: "Big show night",
			eventType: "show",
			startTime: new Date("2026-03-16T20:00:00Z"),
			endTime: new Date("2026-03-16T22:00:00Z"),
			callTime: new Date("2026-03-16T19:00:00Z"),
			location: "Grand Stage",
			timezone: "America/New_York",
			createdById: "user-2",
			createdFromRequestId: null,
			reminderSentAt: null,
			confirmationReminderSentAt: null,
			createdAt: new Date("2026-03-05T00:00:00Z"),
			updatedAt: new Date("2026-03-12T12:00:00Z"),
			groupName: "Team Beta",
			userRole: "Performer",
		},
	];

	it("returns valid iCal feed for valid token", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: "America/Los_Angeles",
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toContain("BEGIN:VCALENDAR");
		expect(body).toContain("END:VCALENDAR");
		expect(body).toContain("METHOD:PUBLISH");
		expect(body).toContain("X-WR-CALNAME:My Call Time");
	});

	it("returns correct Content-Type header", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
	});

	it("does not include Content-Disposition header", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		expect(response.headers.get("Content-Disposition")).toBeNull();
	});

	it("sets Cache-Control to public, max-age=300", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
	});

	it("sets X-Robots-Tag to prevent indexing", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
	});

	it("returns 404 for unknown token", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		await expect(
			loader({
				request: new Request(`http://localhost/api/calendar/${unknownHexToken}.ics`),
				params: { token: `${unknownHexToken}.ics` },
				context: {},
			}),
		).rejects.toThrow();
	});

	it("returns 404 when token param is missing", async () => {
		await expect(
			loader({
				request: new Request("http://localhost/api/calendar/.ics"),
				params: {},
				context: {},
			}),
		).rejects.toThrow();
	});

	it("returns 404 when URL does not end in .ics", async () => {
		await expect(
			loader({
				request: new Request(`http://localhost/api/calendar/${validHexToken}`),
				params: { token: validHexToken },
				context: {},
			}),
		).rejects.toThrow();
	});

	it("returns 404 for non-hex token", async () => {
		await expect(
			loader({
				request: new Request("http://localhost/api/calendar/not-a-hex-token.ics"),
				params: { token: "not-a-hex-token.ics" },
				context: {},
			}),
		).rejects.toThrow();
	});

	it("includes events from multiple groups", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		const body = await response.text();
		expect(body).toContain("SUMMARY:Friday Rehearsal");
		expect(body).toContain("SUMMARY:Saturday Show");
		expect(body).toContain("CATEGORIES:Team Alpha");
		expect(body).toContain("CATEGORIES:Team Beta");
	});

	it("uses callTime for performers at shows", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		const body = await response.text();
		// Event 2 is a show with Performer role — should use callTime (19:00Z)
		expect(body).toContain("DTSTART:20260316T190000Z");
	});

	it("returns empty feed for user with no events", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		const body = await response.text();
		expect(body).toContain("BEGIN:VCALENDAR");
		expect(body).toContain("END:VCALENDAR");
		expect(body).not.toContain("BEGIN:VEVENT");
	});

	it("only includes non-declined events (declined events excluded by service)", async () => {
		// getUserCalendarEvents includes all group events except those the user
		// explicitly declined. Events with no assignment are included (LEFT JOIN).
		// Declined assignments are the only ones filtered out.
		const assignedEvents = [
			{
				id: "event-assigned",
				groupId: "group-1",
				title: "Confirmed Rehearsal",
				description: null,
				eventType: "rehearsal",
				startTime: new Date("2026-03-20T19:00:00Z"),
				endTime: new Date("2026-03-20T21:00:00Z"),
				callTime: null,
				location: null,
				timezone: "America/Los_Angeles",
				createdById: "user-2",
				createdFromRequestId: null,
				reminderSentAt: null,
				confirmationReminderSentAt: null,
				createdAt: new Date("2026-03-01T00:00:00Z"),
				updatedAt: new Date("2026-03-10T12:00:00Z"),
				groupName: "Team Alpha",
				userRole: "Performer",
			},
		];
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue(assignedEvents);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		const body = await response.text();
		expect(body).toContain("SUMMARY:Confirmed Rehearsal");
		// No declined or unassigned events should appear
		expect(body).not.toContain("Declined");
	});

	it("handles events with null userRole", async () => {
		// Some assignments may have no explicit role set
		const eventsWithNullRole = [
			{
				id: "event-no-role",
				groupId: "group-1",
				title: "Team Meeting",
				description: null,
				eventType: "other",
				startTime: new Date("2026-03-22T18:00:00Z"),
				endTime: new Date("2026-03-22T19:00:00Z"),
				callTime: null,
				location: null,
				timezone: "America/Los_Angeles",
				createdById: "user-2",
				createdFromRequestId: null,
				reminderSentAt: null,
				confirmationReminderSentAt: null,
				createdAt: new Date("2026-03-01T00:00:00Z"),
				updatedAt: new Date("2026-03-10T12:00:00Z"),
				groupName: "Team Alpha",
				userRole: null,
			},
		];
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue(eventsWithNullRole);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		const body = await response.text();
		expect(body).toContain("SUMMARY:Team Meeting");
		// With null role and no callTime, should use regular startTime
		expect(body).toContain("DTSTART:20260322T180000Z");
	});

	it("includes ETag header in response", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		const etag = response.headers.get("ETag");
		expect(etag).toBeTruthy();
		expect(etag).toMatch(/^"[a-f0-9]{64}"$/);
	});

	it("returns 304 Not Modified when If-None-Match matches ETag", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		// First request to get the ETag
		const first = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});
		const etag = first.headers.get("ETag") as string;

		// Second request with If-None-Match
		const second = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`, {
				headers: { "If-None-Match": etag },
			}),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		expect(second.status).toBe(304);
		const body = await second.text();
		expect(body).toBe("");
	});

	it("returns 200 with full content when If-None-Match does not match", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`, {
				headers: { "If-None-Match": '"stale-etag-value"' },
			}),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toContain("BEGIN:VCALENDAR");
	});

	it("returns 429 when rate limited", async () => {
		(getUserByCalendarToken as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			timezone: null,
		});
		(getUserCalendarEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		// Exhaust the 30-request limit
		for (let i = 0; i < 30; i++) {
			await loader({
				request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
				params: { token: `${validHexToken}.ics` },
				context: {},
			});
		}

		// 31st request should be rate limited
		const response = await loader({
			request: new Request(`http://localhost/api/calendar/${validHexToken}.ics`),
			params: { token: `${validHexToken}.ics` },
			context: {},
		});

		expect(response.status).toBe(429);
		expect(response.headers.get("Retry-After")).toBeTruthy();
	});
});
