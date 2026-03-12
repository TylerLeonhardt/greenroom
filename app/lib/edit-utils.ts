import { formatEventTime, formatTime } from "./date-utils";

export interface EventSnapshot {
	title: string;
	description?: string | null;
	eventType: string;
	startTime: Date;
	endTime: Date;
	location?: string | null;
	callTime?: Date | null;
	timezone?: string;
}

export interface EventChanges {
	title?: { old: string; new: string };
	eventType?: { old: string; new: string };
	startTime?: { old: Date; new: Date };
	endTime?: { old: Date; new: Date };
	location?: { old: string | null; new: string | null };
	description?: { old: string | null; new: string | null };
	timezone?: { old: string; new: string };
	callTime?: { old: Date | null; new: Date | null };
}

export interface AvailabilityRequestSnapshot {
	title: string;
	description?: string | null;
	requestedDates: string[];
}

export interface AvailabilityRequestChanges {
	title?: { old: string; new: string };
	description?: { old: string | null; new: string | null };
	datesAdded?: string[];
	datesRemoved?: string[];
}

export function detectEventChanges(oldEvent: EventSnapshot, newEvent: EventSnapshot): EventChanges {
	const changes: EventChanges = {};
	if (oldEvent.title !== newEvent.title)
		changes.title = { old: oldEvent.title, new: newEvent.title };
	if (oldEvent.eventType !== newEvent.eventType)
		changes.eventType = { old: oldEvent.eventType, new: newEvent.eventType };
	if (oldEvent.startTime.getTime() !== newEvent.startTime.getTime())
		changes.startTime = { old: oldEvent.startTime, new: newEvent.startTime };
	if (oldEvent.endTime.getTime() !== newEvent.endTime.getTime())
		changes.endTime = { old: oldEvent.endTime, new: newEvent.endTime };
	const oldLoc = oldEvent.location?.trim() || "";
	const newLoc = newEvent.location?.trim() || "";
	if (oldLoc !== newLoc)
		changes.location = {
			old: oldEvent.location?.trim() || null,
			new: newEvent.location?.trim() || null,
		};
	const oldDesc = oldEvent.description?.trim() || "";
	const newDesc = newEvent.description?.trim() || "";
	if (oldDesc !== newDesc)
		changes.description = {
			old: oldEvent.description?.trim() || null,
			new: newEvent.description?.trim() || null,
		};
	const oldTz = oldEvent.timezone ?? "";
	const newTz = newEvent.timezone ?? "";
	if (oldTz !== newTz && (oldTz || newTz))
		changes.timezone = { old: oldEvent.timezone ?? "", new: newEvent.timezone ?? "" };
	const oldCT = oldEvent.callTime?.getTime() ?? null;
	const newCT = newEvent.callTime?.getTime() ?? null;
	if (oldCT !== newCT)
		changes.callTime = { old: oldEvent.callTime ?? null, new: newEvent.callTime ?? null };
	return changes;
}

export function hasAnyChanges(changes: EventChanges): boolean {
	return Object.keys(changes).length > 0;
}

export function hasScheduleChanges(changes: EventChanges): boolean {
	return !!(changes.startTime || changes.endTime || changes.location || changes.callTime);
}

export function formatEventChangeSummary(changes: EventChanges, timezone?: string): string[] {
	const lines: string[] = [];
	if (changes.title)
		lines.push(`Title changed from "${changes.title.old}" to "${changes.title.new}"`);
	if (changes.eventType)
		lines.push(
			`Type changed from ${formatEventType(changes.eventType.old)} to ${formatEventType(changes.eventType.new)}`,
		);
	if (changes.startTime || changes.endTime) {
		const os = changes.startTime?.old ?? changes.startTime?.new ?? new Date();
		const ns = changes.startTime?.new ?? changes.startTime?.old ?? new Date();
		const oe = changes.endTime?.old ?? changes.endTime?.new ?? os;
		const ne = changes.endTime?.new ?? changes.endTime?.old ?? ns;
		lines.push(
			`Time changed from ${formatEventTime(os, oe, timezone)} to ${formatEventTime(ns, ne, timezone)}`,
		);
	}
	if (changes.location) {
		if (!changes.location.new) lines.push(`Location "${changes.location.old}" removed`);
		else if (!changes.location.old) lines.push(`Location set to "${changes.location.new}"`);
		else lines.push(`Location changed from "${changes.location.old}" to "${changes.location.new}"`);
	}
	if (changes.description) lines.push("Description updated");
	if (changes.timezone)
		lines.push(`Timezone changed from ${changes.timezone.old} to ${changes.timezone.new}`);
	if (changes.callTime) {
		if (changes.callTime.new)
			lines.push(`Call time changed to ${formatTime(changes.callTime.new, timezone)}`);
		else lines.push("Call time removed");
	}
	return lines;
}

export function detectAvailabilityRequestChanges(
	oldReq: AvailabilityRequestSnapshot,
	newReq: AvailabilityRequestSnapshot,
): AvailabilityRequestChanges {
	const changes: AvailabilityRequestChanges = {};
	if (oldReq.title !== newReq.title) changes.title = { old: oldReq.title, new: newReq.title };
	const od = oldReq.description?.trim() || "";
	const nd = newReq.description?.trim() || "";
	if (od !== nd)
		changes.description = {
			old: oldReq.description?.trim() || null,
			new: newReq.description?.trim() || null,
		};
	const oldDates = new Set(oldReq.requestedDates);
	const newDates = new Set(newReq.requestedDates);
	const added = newReq.requestedDates.filter((d) => !oldDates.has(d)).sort();
	const removed = oldReq.requestedDates.filter((d) => !newDates.has(d)).sort();
	if (added.length > 0) changes.datesAdded = added;
	if (removed.length > 0) changes.datesRemoved = removed;
	return changes;
}

export function hasAnyAvailabilityRequestChanges(changes: AvailabilityRequestChanges): boolean {
	return Object.keys(changes).length > 0;
}

export function formatAvailabilityRequestChangeSummary(
	changes: AvailabilityRequestChanges,
): string[] {
	const lines: string[] = [];
	if (changes.title)
		lines.push(`Title changed from "${changes.title.old}" to "${changes.title.new}"`);
	if (changes.description) lines.push("Description updated");
	if (changes.datesAdded && changes.datesAdded.length > 0) {
		const n = changes.datesAdded.length;
		lines.push(`${n} date${n > 1 ? "s" : ""} added`);
	}
	if (changes.datesRemoved && changes.datesRemoved.length > 0) {
		const n = changes.datesRemoved.length;
		lines.push(`${n} date${n > 1 ? "s" : ""} removed`);
	}
	return lines;
}

function formatEventType(type: string): string {
	switch (type) {
		case "rehearsal":
			return "Rehearsal";
		case "show":
			return "Show";
		default:
			return "Other";
	}
}
