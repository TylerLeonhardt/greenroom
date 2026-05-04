import { describe, expect, it } from "vitest";
import {
	type CalendarEvent,
	escapeICalText,
	foldLine,
	formatICalDate,
	generateCalendarFeed,
} from "./ical-utils";

describe("formatICalDate", () => {
	it("formats a UTC date correctly", () => {
		const date = new Date("2026-03-15T19:00:00Z");
		expect(formatICalDate(date)).toBe("20260315T190000Z");
	});

	it("formats midnight correctly", () => {
		const date = new Date("2026-01-01T00:00:00Z");
		expect(formatICalDate(date)).toBe("20260101T000000Z");
	});

	it("formats end-of-day correctly", () => {
		const date = new Date("2026-12-31T23:59:59Z");
		expect(formatICalDate(date)).toBe("20261231T235959Z");
	});
});

describe("escapeICalText", () => {
	it("escapes backslashes", () => {
		expect(escapeICalText("back\\slash")).toBe("back\\\\slash");
	});

	it("escapes semicolons", () => {
		expect(escapeICalText("semi;colon")).toBe("semi\\;colon");
	});

	it("escapes commas", () => {
		expect(escapeICalText("com,ma")).toBe("com\\,ma");
	});

	it("escapes newlines", () => {
		expect(escapeICalText("line\nbreak")).toBe("line\\nbreak");
	});

	it("escapes multiple special characters", () => {
		expect(escapeICalText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
	});

	it("returns plain text unchanged", () => {
		expect(escapeICalText("Hello World")).toBe("Hello World");
	});
});

describe("foldLine", () => {
	it("returns short lines unchanged", () => {
		expect(foldLine("SHORT LINE")).toBe("SHORT LINE");
	});

	it("returns a line of exactly 75 chars unchanged", () => {
		const line = "A".repeat(75);
		expect(foldLine(line)).toBe(line);
	});

	it("folds long lines at 75 chars with continuation space", () => {
		const line = "A".repeat(150);
		const folded = foldLine(line);
		// First line: 75 chars, then continuation lines start with space
		const parts = folded.split("\r\n");
		expect(parts[0]).toHaveLength(75);
		expect(parts[1]).toMatch(/^ /);
	});

	it("unfolding reconstructs the original line", () => {
		const line = "B".repeat(200);
		const folded = foldLine(line);
		// RFC 5545: unfold by removing CRLF + single whitespace
		const unfolded = folded.replace(/\r\n /g, "");
		expect(unfolded).toBe(line);
	});
});

describe("generateCalendarFeed", () => {
	const baseEvent: CalendarEvent = {
		id: "event-1",
		title: "Friday Rehearsal",
		description: "Weekly practice",
		location: "Main Theater",
		startTime: new Date("2026-03-15T19:00:00Z"),
		endTime: new Date("2026-03-15T21:00:00Z"),
		callTime: null,
		eventType: "rehearsal",
		groupName: "Team Alpha",
		userRole: null,
		updatedAt: new Date("2026-03-10T12:00:00Z"),
	};

	it("generates valid VCALENDAR structure", () => {
		const feed = generateCalendarFeed([baseEvent]);
		expect(feed).toContain("BEGIN:VCALENDAR");
		expect(feed).toContain("END:VCALENDAR");
		expect(feed).toContain("VERSION:2.0");
		expect(feed).toContain("METHOD:PUBLISH");
		expect(feed).toContain("X-WR-CALNAME:My Call Time");
	});

	it("generates VEVENT for each event", () => {
		const events = [baseEvent, { ...baseEvent, id: "event-2", title: "Saturday Show" }];
		const feed = generateCalendarFeed(events);
		const beginCount = (feed.match(/BEGIN:VEVENT/g) || []).length;
		const endCount = (feed.match(/END:VEVENT/g) || []).length;
		expect(beginCount).toBe(2);
		expect(endCount).toBe(2);
	});

	it("uses correct UID format", () => {
		const feed = generateCalendarFeed([baseEvent]);
		expect(feed).toContain("UID:event-1@mycalltime.app");
	});

	it("includes SUMMARY, DESCRIPTION, LOCATION", () => {
		const feed = generateCalendarFeed([baseEvent]);
		expect(feed).toContain("SUMMARY:Friday Rehearsal");
		expect(feed).toContain("DESCRIPTION:");
		expect(feed).toContain("LOCATION:Main Theater");
	});

	it("includes group name in description", () => {
		const feed = generateCalendarFeed([baseEvent]);
		expect(feed).toContain("Group: Team Alpha");
	});

	it("includes group name as CATEGORIES", () => {
		const feed = generateCalendarFeed([baseEvent]);
		expect(feed).toContain("CATEGORIES:Team Alpha");
	});

	it("includes LAST-MODIFIED from updatedAt", () => {
		const feed = generateCalendarFeed([baseEvent]);
		expect(feed).toContain("LAST-MODIFIED:20260310T120000Z");
	});

	it("uses startTime for non-performer events", () => {
		const feed = generateCalendarFeed([baseEvent]);
		expect(feed).toContain("DTSTART:20260315T190000Z");
		expect(feed).toContain("DTEND:20260315T210000Z");
	});

	it("uses callTime for performers at shows", () => {
		const showEvent: CalendarEvent = {
			...baseEvent,
			eventType: "show",
			callTime: new Date("2026-03-15T18:00:00Z"),
			userRole: "Performer",
		};
		const feed = generateCalendarFeed([showEvent]);
		expect(feed).toContain("DTSTART:20260315T180000Z");
	});

	it("uses startTime for non-performers at shows with callTime", () => {
		const showEvent: CalendarEvent = {
			...baseEvent,
			eventType: "show",
			callTime: new Date("2026-03-15T18:00:00Z"),
			userRole: "Viewer",
		};
		const feed = generateCalendarFeed([showEvent]);
		expect(feed).toContain("DTSTART:20260315T190000Z");
	});

	it("uses startTime for performers at non-show events", () => {
		const event: CalendarEvent = {
			...baseEvent,
			eventType: "rehearsal",
			callTime: new Date("2026-03-15T18:00:00Z"),
			userRole: "Performer",
		};
		const feed = generateCalendarFeed([event]);
		expect(feed).toContain("DTSTART:20260315T190000Z");
	});

	it("omits DESCRIPTION when no description and no group name", () => {
		const event: CalendarEvent = {
			...baseEvent,
			description: null,
			groupName: "",
		};
		const feed = generateCalendarFeed([event]);
		expect(feed).not.toContain("DESCRIPTION:");
	});

	it("omits LOCATION when not set", () => {
		const event: CalendarEvent = {
			...baseEvent,
			location: null,
		};
		const feed = generateCalendarFeed([event]);
		expect(feed).not.toContain("LOCATION:");
	});

	it("generates empty feed with no events", () => {
		const feed = generateCalendarFeed([]);
		expect(feed).toContain("BEGIN:VCALENDAR");
		expect(feed).toContain("END:VCALENDAR");
		expect(feed).not.toContain("BEGIN:VEVENT");
	});

	it("separates group name and description with iCal newline", () => {
		const feed = generateCalendarFeed([baseEvent]);
		// iCal newline is \n escaped as \\n in the raw text
		expect(feed).toContain("Group: Team Alpha\\nWeekly practice");
		expect(feed).not.toContain("Group: Team Alpha\\\\nWeekly practice");
	});

	it("uses CRLF line endings", () => {
		const feed = generateCalendarFeed([baseEvent]);
		expect(feed).toContain("\r\n");
		// Should not have bare LF (all LF should be preceded by CR)
		const lines = feed.split("\r\n");
		for (const line of lines) {
			expect(line).not.toContain("\n");
		}
	});
});
