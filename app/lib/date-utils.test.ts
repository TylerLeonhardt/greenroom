import { describe, expect, it } from "vitest";
import {
	formatDate,
	formatDateDisplay,
	formatDateLong,
	formatDateMedium,
	formatDateRange,
	formatDateShort,
	formatDateTime,
	formatEventTime,
	formatTime,
	formatTimeRange,
} from "./date-utils";

describe("date-utils", () => {
	// Use a fixed date: March 4, 2026, 7:00 PM UTC
	const testDate = new Date("2026-03-04T19:00:00Z");
	const testEndDate = new Date("2026-03-04T21:00:00Z");

	describe("formatDate", () => {
		it("formats a date with weekday, month, day, and year", () => {
			const result = formatDate(testDate, "UTC");
			expect(result).toBe("Wed, Mar 4, 2026");
		});

		it("accepts string input", () => {
			const result = formatDate("2026-03-04T19:00:00Z", "UTC");
			expect(result).toBe("Wed, Mar 4, 2026");
		});

		it("respects timezone", () => {
			// 7 PM UTC = 12 PM Pacific (same day) or next day in some far-east timezones
			const utcResult = formatDate(testDate, "UTC");
			expect(utcResult).toContain("Mar 4");
		});
	});

	describe("formatTime", () => {
		it("formats time in 12-hour format", () => {
			const result = formatTime(testDate, "UTC");
			expect(result).toBe("7:00 PM");
		});

		it("formats morning time correctly", () => {
			const morning = new Date("2026-03-04T09:30:00Z");
			const result = formatTime(morning, "UTC");
			expect(result).toBe("9:30 AM");
		});

		it("accepts string input", () => {
			const result = formatTime("2026-03-04T19:00:00Z", "UTC");
			expect(result).toBe("7:00 PM");
		});
	});

	describe("formatDateTime", () => {
		it("formats date and time with separator", () => {
			const result = formatDateTime(testDate, "UTC");
			expect(result).toBe("Wed, Mar 4 · 7:00 PM");
		});
	});

	describe("formatDateRange", () => {
		it("formats same-year range with year on end date only", () => {
			const start = new Date("2026-03-01T00:00:00Z");
			const end = new Date("2026-03-28T00:00:00Z");
			const result = formatDateRange(start, end, "UTC");
			expect(result).toBe("Mar 1 – Mar 28, 2026");
		});

		it("formats cross-year range with year on both dates", () => {
			const start = new Date("2025-12-20T00:00:00Z");
			const end = new Date("2026-01-05T00:00:00Z");
			const result = formatDateRange(start, end, "UTC");
			expect(result).toBe("Dec 20, 2025 – Jan 5, 2026");
		});

		it("accepts string input", () => {
			const result = formatDateRange("2026-03-01T00:00:00Z", "2026-03-28T00:00:00Z", "UTC");
			expect(result).toBe("Mar 1 – Mar 28, 2026");
		});
	});

	describe("formatEventTime", () => {
		it("formats event time range with date", () => {
			const result = formatEventTime(testDate, testEndDate, "UTC");
			expect(result).toBe("Wed, Mar 4 · 7:00 PM – 9:00 PM");
		});

		it("accepts string input", () => {
			const result = formatEventTime("2026-03-04T19:00:00Z", "2026-03-04T21:00:00Z", "UTC");
			expect(result).toBe("Wed, Mar 4 · 7:00 PM – 9:00 PM");
		});
	});

	describe("formatDateDisplay", () => {
		it("returns day of week and short display", () => {
			const result = formatDateDisplay("2026-03-04");
			expect(result.dayOfWeek).toBe("Wed");
			expect(result.display).toBe("Mar 4");
		});
	});

	describe("formatDateLong", () => {
		it("formats with full weekday and month", () => {
			const result = formatDateLong(testDate, "UTC");
			expect(result).toBe("Wednesday, March 4, 2026");
		});
	});

	describe("formatDateMedium", () => {
		it("formats with full month, day, and year", () => {
			const result = formatDateMedium(testDate, "UTC");
			expect(result).toBe("March 4, 2026");
		});
	});

	describe("formatDateShort", () => {
		it("formats with short weekday, month, and day", () => {
			const result = formatDateShort(testDate, "UTC");
			expect(result).toBe("Wed, Mar 4");
		});
	});

	describe("formatTimeRange", () => {
		it("formats HH:MM time range", () => {
			const result = formatTimeRange("19:00", "21:00");
			expect(result).toBe("7:00 PM – 9:00 PM");
		});

		it("returns 'All day' when no times provided", () => {
			expect(formatTimeRange(null, null)).toBe("All day");
			expect(formatTimeRange(undefined, undefined)).toBe("All day");
			expect(formatTimeRange("19:00", null)).toBe("All day");
		});

		it("handles morning times", () => {
			const result = formatTimeRange("09:30", "11:00");
			expect(result).toBe("9:30 AM – 11:00 AM");
		});

		it("handles noon", () => {
			const result = formatTimeRange("12:00", "13:00");
			expect(result).toBe("12:00 PM – 1:00 PM");
		});

		it("handles midnight", () => {
			const result = formatTimeRange("00:00", "02:00");
			expect(result).toBe("12:00 AM – 2:00 AM");
		});
	});
});
