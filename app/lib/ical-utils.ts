/**
 * Shared iCalendar (RFC 5545) utility functions.
 */

/** Format a Date to iCalendar UTC date-time string (e.g. 20260315T190000Z). */
export function formatICalDate(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
}

/** Escape text for iCalendar property values (RFC 5545 §3.3.11). */
export function escapeICalText(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");
}

/** Fold a content line to 75 octets per RFC 5545 §3.1. */
export function foldLine(line: string): string {
	const maxLen = 75;
	if (line.length <= maxLen) return line;
	const parts: string[] = [];
	parts.push(line.slice(0, maxLen));
	let i = maxLen;
	while (i < line.length) {
		parts.push(` ${line.slice(i, i + maxLen - 1)}`);
		i += maxLen - 1;
	}
	return parts.join("\r\n");
}

export interface CalendarEvent {
	id: string;
	title: string;
	description: string | null;
	location: string | null;
	startTime: Date;
	endTime: Date;
	callTime: Date | null;
	eventType: string;
	groupName: string;
	userRole: string | null;
	updatedAt: Date;
}

/**
 * Generate a multi-event iCalendar feed (VCALENDAR with multiple VEVENTs).
 * Uses UTC times throughout (no VTIMEZONE needed).
 */
export function generateCalendarFeed(calendarEvents: CalendarEvent[]): string {
	const now = new Date();
	const lines: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//My Call Time//Calendar Feed//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		foldLine("X-WR-CALNAME:My Call Time"),
	];

	for (const event of calendarEvents) {
		const isPerformerAtShow =
			event.userRole === "Performer" && event.eventType === "show" && event.callTime;
		const startTime = isPerformerAtShow ? (event.callTime as Date) : event.startTime;
		const uid = `${event.id}@mycalltime.app`;

		const eventLines: string[] = [
			"BEGIN:VEVENT",
			foldLine(`UID:${uid}`),
			`DTSTAMP:${formatICalDate(now)}`,
			`DTSTART:${formatICalDate(startTime)}`,
			`DTEND:${formatICalDate(event.endTime)}`,
			`LAST-MODIFIED:${formatICalDate(event.updatedAt)}`,
			foldLine(`SUMMARY:${escapeICalText(event.title)}`),
		];

		// Include group name in description
		const descParts: string[] = [];
		if (event.groupName) {
			descParts.push(`Group: ${event.groupName}`);
		}
		if (event.description) {
			descParts.push(event.description);
		}
		if (descParts.length > 0) {
			eventLines.push(foldLine(`DESCRIPTION:${escapeICalText(descParts.join("\\n"))}`));
		}

		if (event.location) {
			eventLines.push(foldLine(`LOCATION:${escapeICalText(event.location)}`));
		}

		if (event.groupName) {
			eventLines.push(foldLine(`CATEGORIES:${escapeICalText(event.groupName)}`));
		}

		eventLines.push("END:VEVENT");
		lines.push(...eventLines);
	}

	lines.push("END:VCALENDAR");
	return lines.join("\r\n");
}
