import { describe, expect, it, vi } from "vitest";

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
import { loader } from "./api.calendar.$token";

describe("GET /api/calendar/:token.ics", () => {
	const validHexToken = "aabb1122ccdd3344eeff5566aabb1122";
	const unknownHexToken = "deadbeefdeadbeefdeadbeefdeadbeef";
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

	it("sets cache control to private, no-store", async () => {
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

		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
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
});
