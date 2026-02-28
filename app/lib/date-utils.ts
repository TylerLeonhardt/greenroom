/**
 * Centralized date formatting utilities for My Call Time.
 * All date display should use these functions to ensure consistent
 * timezone-aware formatting across the app.
 *
 * Uses Intl.DateTimeFormat under the hood for locale-aware output.
 * Falls back to UTC when no timezone is provided.
 */

/**
 * Format a date as "Wed, Mar 4, 2026"
 */
export function formatDate(date: string | Date, timezone?: string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: timezone,
	});
}

/**
 * Format a time as "7:00 PM"
 */
export function formatTime(date: string | Date, timezone?: string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone,
	});
}

/**
 * Format a date and time as "Wed, Mar 4 · 7:00 PM"
 */
export function formatDateTime(date: string | Date, timezone?: string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	const dateStr = d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		timeZone: timezone,
	});
	const timeStr = formatTime(d, timezone);
	return `${dateStr} · ${timeStr}`;
}

/**
 * Format a date range as "Mar 1 – Mar 28, 2026"
 * If both dates are in the same year, the year only appears on the end date.
 */
export function formatDateRange(
	start: string | Date,
	end: string | Date,
	timezone?: string,
): string {
	const s = typeof start === "string" ? new Date(start) : start;
	const e = typeof end === "string" ? new Date(end) : end;
	const opts: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		timeZone: timezone,
	};
	const yearOpts: Intl.DateTimeFormatOptions = {
		...opts,
		year: "numeric",
	};

	const sYear = s.toLocaleDateString("en-US", { year: "numeric", timeZone: timezone });
	const eYear = e.toLocaleDateString("en-US", { year: "numeric", timeZone: timezone });

	if (sYear === eYear) {
		return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", yearOpts)}`;
	}
	return `${s.toLocaleDateString("en-US", yearOpts)} – ${e.toLocaleDateString("en-US", yearOpts)}`;
}

/**
 * Format an event's time range as "Wed, Mar 4 · 7:00 PM – 9:00 PM"
 */
export function formatEventTime(
	startTime: string | Date,
	endTime: string | Date,
	timezone?: string,
): string {
	const start = typeof startTime === "string" ? new Date(startTime) : startTime;
	const end = typeof endTime === "string" ? new Date(endTime) : endTime;
	const dateStr = start.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		timeZone: timezone,
	});
	const startStr = formatTime(start, timezone);
	const endStr = formatTime(end, timezone);
	return `${dateStr} · ${startStr} – ${endStr}`;
}

/**
 * Format a date for display in grids/heatmaps.
 * Returns both the day of week and a short date display.
 */
export function formatDateDisplay(
	dateStr: string,
	timezone?: string,
): { dayOfWeek: string; display: string } {
	const date = new Date(`${dateStr}T12:00:00Z`);
	return {
		dayOfWeek: date.toLocaleDateString("en-US", { weekday: "short", timeZone: timezone }),
		display: date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			timeZone: timezone,
		}),
	};
}

/**
 * Format a date with full details for display:
 * "Wednesday, March 4, 2026"
 */
export function formatDateLong(date: string | Date, timezone?: string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: timezone,
	});
}

/**
 * Format a date for availability request display:
 * "March 4, 2026"
 */
export function formatDateMedium(date: string | Date, timezone?: string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: timezone,
	});
}

/**
 * Format a short date with weekday for preview chips:
 * "Mon, Mar 4"
 */
export function formatDateShort(date: string | Date, timezone?: string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		timeZone: timezone,
	});
}

/**
 * Format a time range for availability display:
 * "7:00 PM – 9:00 PM" or "All day" if no times provided.
 */
export function formatTimeRange(startTime?: string | null, endTime?: string | null): string {
	if (!startTime || !endTime) return "All day";
	// startTime/endTime are "HH:MM" format
	const format = (t: string) => {
		const [h, m] = t.split(":").map(Number);
		const period = h >= 12 ? "PM" : "AM";
		const hour12 = h % 12 || 12;
		return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
	};
	return `${format(startTime)} – ${format(endTime)}`;
}

/**
 * Convert a local date/time in a specific timezone to a UTC Date.
 *
 * When a user in "America/Los_Angeles" enters 19:00 on 2026-03-15,
 * we need to store it as 02:00 UTC on 2026-03-16 (PDT = UTC-7).
 * Without this, `new Date("2026-03-15T19:00:00")` on a UTC server
 * stores 19:00 UTC, which displays as 12:00 PM in LA — a 7-hour shift.
 *
 * Uses iterative refinement to handle DST transitions correctly.
 */
export function localTimeToUTC(dateStr: string, timeStr: string, timezone?: string | null): Date {
	if (!timezone) {
		// No timezone — interpret as server-local time (existing behavior)
		return new Date(`${dateStr}T${timeStr}:00`);
	}

	const [year, month, day] = dateStr.split("-").map(Number);
	const [hour, minute] = timeStr.split(":").map(Number);

	let guess = Date.UTC(year, month - 1, day, hour, minute, 0);

	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	// Iteratively refine to handle DST transitions
	for (let i = 0; i < 3; i++) {
		const parts = formatter.formatToParts(new Date(guess));
		const get = (type: string) => {
			const val = Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
			return type === "hour" && val === 24 ? 0 : val;
		};

		const actualYear = get("year");
		const actualMonth = get("month");
		const actualDay = get("day");
		const actualHour = get("hour");
		const actualMinute = get("minute");

		if (
			actualYear === year &&
			actualMonth === month &&
			actualDay === day &&
			actualHour === hour &&
			actualMinute === minute
		) {
			return new Date(guess);
		}

		// Adjust guess based on the difference
		const actualAsUTC = Date.UTC(
			actualYear,
			actualMonth - 1,
			actualDay,
			actualHour,
			actualMinute,
			0,
		);
		const targetAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
		guess += targetAsUTC - actualAsUTC;
	}

	return new Date(guess);
}

/**
 * Convert a UTC Date to local date/time strings in a specific timezone.
 * Returns { date: "YYYY-MM-DD", time: "HH:MM" } for form prefilling.
 */
export function utcToLocalParts(
	date: Date,
	timezone?: string | null,
): { date: string; time: string } {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone ?? undefined,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	const parts = formatter.formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
	const hour = get("hour") === "24" ? "00" : get("hour");

	return {
		date: `${get("year")}-${get("month")}-${get("day")}`,
		time: `${hour}:${get("minute")}`,
	};
}
