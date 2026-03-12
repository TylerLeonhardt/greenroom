import { describe, expect, it } from "vitest";
import {
	type AvailabilityRequestChanges,
	detectAvailabilityRequestChanges,
	detectEventChanges,
	type EventChanges,
	formatAvailabilityRequestChangeSummary,
	formatEventChangeSummary,
	hasAnyAvailabilityRequestChanges,
	hasAnyChanges,
	hasScheduleChanges,
} from "./edit-utils";

const TZ = "America/New_York";

function makeEvent(
	overrides: Partial<{
		title: string;
		eventType: string;
		startTime: Date;
		endTime: Date;
		location: string | null;
		description: string | null;
		callTime: Date | null;
		timezone: string;
	}> = {},
) {
	return {
		title: "Weekly Rehearsal",
		eventType: "rehearsal",
		startTime: new Date("2026-03-15T23:00:00Z"),
		endTime: new Date("2026-03-16T01:00:00Z"),
		location: "The Theater" as string | null,
		description: "Regular practice" as string | null,
		callTime: null as Date | null,
		timezone: TZ,
		...overrides,
	};
}

describe("detectEventChanges", () => {
	it("returns empty object when nothing changed", () => {
		expect(detectEventChanges(makeEvent(), makeEvent())).toEqual({});
	});

	it("detects title change", () => {
		const changes = detectEventChanges(makeEvent(), makeEvent({ title: "Special Rehearsal" }));
		expect(changes).toEqual({
			title: { old: "Weekly Rehearsal", new: "Special Rehearsal" },
		});
	});

	it("detects eventType change", () => {
		const changes = detectEventChanges(makeEvent(), makeEvent({ eventType: "show" }));
		expect(changes).toEqual({
			eventType: { old: "rehearsal", new: "show" },
		});
	});

	it("detects date change via startTime and endTime", () => {
		const changes = detectEventChanges(
			makeEvent(),
			makeEvent({
				startTime: new Date("2026-03-16T23:00:00Z"),
				endTime: new Date("2026-03-17T01:00:00Z"),
			}),
		);
		expect(changes.startTime).toBeDefined();
		expect(changes.startTime!.new).toEqual(new Date("2026-03-16T23:00:00Z"));
		expect(changes.endTime).toBeDefined();
		expect(changes.endTime!.new).toEqual(new Date("2026-03-17T01:00:00Z"));
	});

	it("detects time change on same day", () => {
		const changes = detectEventChanges(
			makeEvent(),
			makeEvent({
				startTime: new Date("2026-03-16T00:00:00Z"),
				endTime: new Date("2026-03-16T02:00:00Z"),
			}),
		);
		expect(changes.startTime).toBeDefined();
		expect(changes.endTime).toBeDefined();
	});

	it("detects location change", () => {
		const changes = detectEventChanges(makeEvent(), makeEvent({ location: "New Venue" }));
		expect(changes).toEqual({
			location: { old: "The Theater", new: "New Venue" },
		});
	});

	it("detects location added", () => {
		const changes = detectEventChanges(
			makeEvent({ location: null }),
			makeEvent({ location: "The Theater" }),
		);
		expect(changes).toEqual({
			location: { old: null, new: "The Theater" },
		});
	});

	it("detects location removed", () => {
		const changes = detectEventChanges(
			makeEvent({ location: "The Theater" }),
			makeEvent({ location: "" }),
		);
		expect(changes).toEqual({
			location: { old: "The Theater", new: null },
		});
	});

	it("detects description change", () => {
		const changes = detectEventChanges(
			makeEvent({ description: null }),
			makeEvent({ description: "Bring your scripts" }),
		);
		expect(changes).toEqual({
			description: { old: null, new: "Bring your scripts" },
		});
	});

	it("detects callTime change", () => {
		const callTime = new Date("2026-03-15T22:00:00Z");
		const changes = detectEventChanges(makeEvent(), makeEvent({ callTime }));
		expect(changes).toEqual({
			callTime: { old: null, new: callTime },
		});
	});

	it("detects multiple changes at once", () => {
		const changes = detectEventChanges(
			makeEvent(),
			makeEvent({ title: "Big Show", eventType: "show", location: "Main Stage" }),
		);
		expect(changes.title).toBeDefined();
		expect(changes.eventType).toBeDefined();
		expect(changes.location).toBeDefined();
		expect(Object.keys(changes)).toHaveLength(3);
	});
});

describe("hasAnyChanges", () => {
	it("returns false for empty changes", () => {
		expect(hasAnyChanges({})).toBe(false);
	});

	it("returns true when there are changes", () => {
		expect(hasAnyChanges({ title: { old: "a", new: "b" } })).toBe(true);
	});
});

describe("hasScheduleChanges", () => {
	it("returns true when startTime changed", () => {
		const changes: EventChanges = {
			startTime: { old: new Date("2026-03-15T23:00:00Z"), new: new Date("2026-03-16T23:00:00Z") },
		};
		expect(hasScheduleChanges(changes)).toBe(true);
	});

	it("returns true when endTime changed", () => {
		const changes: EventChanges = {
			endTime: { old: new Date("2026-03-16T01:00:00Z"), new: new Date("2026-03-16T02:00:00Z") },
		};
		expect(hasScheduleChanges(changes)).toBe(true);
	});

	it("returns true when location changed", () => {
		const changes: EventChanges = {
			location: { old: "A", new: "B" },
		};
		expect(hasScheduleChanges(changes)).toBe(true);
	});

	it("returns true when callTime changed", () => {
		const changes: EventChanges = {
			callTime: { old: null, new: new Date("2026-03-15T22:00:00Z") },
		};
		expect(hasScheduleChanges(changes)).toBe(true);
	});

	it("returns false for title-only change", () => {
		const changes: EventChanges = {
			title: { old: "a", new: "b" },
		};
		expect(hasScheduleChanges(changes)).toBe(false);
	});

	it("returns false for empty changes", () => {
		expect(hasScheduleChanges({})).toBe(false);
	});
});

describe("detectAvailabilityRequestChanges", () => {
	const baseReq = () => ({
		title: "March Schedule",
		description: "Please respond by Friday" as string | null,
		requestedDates: ["2026-03-15", "2026-03-16", "2026-03-17"],
	});

	it("returns empty object when nothing changed", () => {
		expect(detectAvailabilityRequestChanges(baseReq(), baseReq())).toEqual({});
	});

	it("detects title change", () => {
		const changes = detectAvailabilityRequestChanges(baseReq(), {
			...baseReq(),
			title: "April Schedule",
		});
		expect(changes).toEqual({
			title: { old: "March Schedule", new: "April Schedule" },
		});
	});

	it("detects description change", () => {
		const changes = detectAvailabilityRequestChanges(
			{ ...baseReq(), description: null },
			baseReq(),
		);
		expect(changes).toEqual({
			description: { old: null, new: "Please respond by Friday" },
		});
	});

	it("detects dates added", () => {
		const changes = detectAvailabilityRequestChanges(baseReq(), {
			...baseReq(),
			requestedDates: ["2026-03-15", "2026-03-16", "2026-03-17", "2026-03-18"],
		});
		expect(changes).toEqual({
			datesAdded: ["2026-03-18"],
		});
	});

	it("detects dates removed", () => {
		const changes = detectAvailabilityRequestChanges(baseReq(), {
			...baseReq(),
			requestedDates: ["2026-03-15"],
		});
		expect(changes).toEqual({
			datesRemoved: ["2026-03-16", "2026-03-17"],
		});
	});

	it("detects dates added and removed", () => {
		const changes = detectAvailabilityRequestChanges(baseReq(), {
			...baseReq(),
			requestedDates: ["2026-03-15", "2026-03-18"],
		});
		expect(changes.datesAdded).toEqual(["2026-03-18"]);
		expect(changes.datesRemoved).toEqual(["2026-03-16", "2026-03-17"]);
	});

	it("treats different date order as no change", () => {
		const changes = detectAvailabilityRequestChanges(baseReq(), {
			...baseReq(),
			requestedDates: ["2026-03-17", "2026-03-15", "2026-03-16"],
		});
		expect(changes).toEqual({});
	});
});

describe("formatEventChangeSummary", () => {
	it("returns empty array for no changes", () => {
		expect(formatEventChangeSummary({})).toEqual([]);
	});

	it("formats title change", () => {
		const lines = formatEventChangeSummary({ title: { old: "Old Title", new: "New Title" } });
		expect(lines).toEqual(['Title changed from "Old Title" to "New Title"']);
	});

	it("formats eventType change", () => {
		const lines = formatEventChangeSummary({ eventType: { old: "rehearsal", new: "show" } });
		expect(lines).toEqual(["Type changed from Rehearsal to Show"]);
	});

	it("formats time change with timezone", () => {
		const lines = formatEventChangeSummary(
			{
				startTime: {
					old: new Date("2026-03-15T23:00:00Z"),
					new: new Date("2026-03-16T00:00:00Z"),
				},
			},
			TZ,
		);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("Time changed from");
	});

	it("formats location change", () => {
		const lines = formatEventChangeSummary({
			location: { old: "Room A", new: "Room B" },
		});
		expect(lines).toEqual(['Location changed from "Room A" to "Room B"']);
	});

	it("formats location removed", () => {
		const lines = formatEventChangeSummary({
			location: { old: "Room A", new: null },
		});
		expect(lines).toEqual(['Location "Room A" removed']);
	});

	it("formats location added", () => {
		const lines = formatEventChangeSummary({
			location: { old: null, new: "Room B" },
		});
		expect(lines).toEqual(['Location set to "Room B"']);
	});

	it("formats description change", () => {
		const lines = formatEventChangeSummary({
			description: { old: null, new: "Notes here" },
		});
		expect(lines).toEqual(["Description updated"]);
	});

	it("formats callTime added with timezone", () => {
		const lines = formatEventChangeSummary(
			{ callTime: { old: null, new: new Date("2026-03-15T22:00:00Z") } },
			TZ,
		);
		expect(lines).toEqual(["Call time changed to 6:00 PM"]);
	});

	it("formats callTime removed", () => {
		const lines = formatEventChangeSummary({
			callTime: { old: new Date("2026-03-15T22:00:00Z"), new: null },
		});
		expect(lines).toEqual(["Call time removed"]);
	});

	it("formats multiple changes", () => {
		const lines = formatEventChangeSummary({
			title: { old: "A", new: "B" },
			location: { old: "X", new: "Y" },
		});
		expect(lines).toHaveLength(2);
	});
});

describe("hasAnyAvailabilityRequestChanges", () => {
	it("returns false for empty changes", () => {
		expect(hasAnyAvailabilityRequestChanges({})).toBe(false);
	});

	it("returns true when there are changes", () => {
		expect(hasAnyAvailabilityRequestChanges({ datesAdded: ["2026-03-18"] })).toBe(true);
	});
});

describe("formatAvailabilityRequestChangeSummary", () => {
	it("returns empty array for no changes", () => {
		expect(formatAvailabilityRequestChangeSummary({})).toEqual([]);
	});

	it("formats title change", () => {
		const lines = formatAvailabilityRequestChangeSummary({
			title: { old: "March", new: "April" },
		});
		expect(lines).toEqual(['Title changed from "March" to "April"']);
	});

	it("formats description change", () => {
		const lines = formatAvailabilityRequestChangeSummary({
			description: { old: null, new: "New desc" },
		});
		expect(lines).toEqual(["Description updated"]);
	});

	it("formats single date added", () => {
		const lines = formatAvailabilityRequestChangeSummary({
			datesAdded: ["2026-03-18"],
		});
		expect(lines).toEqual(["1 date added"]);
	});

	it("formats multiple dates added", () => {
		const lines = formatAvailabilityRequestChangeSummary({
			datesAdded: ["2026-03-18", "2026-03-19"],
		});
		expect(lines).toEqual(["2 dates added"]);
	});

	it("formats dates removed", () => {
		const lines = formatAvailabilityRequestChangeSummary({
			datesRemoved: ["2026-03-16", "2026-03-17"],
		});
		expect(lines).toEqual(["2 dates removed"]);
	});

	it("formats dates added and removed together", () => {
		const lines = formatAvailabilityRequestChangeSummary({
			datesAdded: ["2026-03-18"],
			datesRemoved: ["2026-03-16", "2026-03-17"],
		});
		expect(lines).toContain("1 date added");
		expect(lines).toContain("2 dates removed");
		expect(lines).toHaveLength(2);
	});
});
