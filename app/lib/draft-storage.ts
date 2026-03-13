// Mock draft storage using localStorage for prototype
// In production, this would be a DB table with a "status" column (draft/published)

export type DraftEvent = {
	id: string;
	title: string;
	eventType: "rehearsal" | "show" | "other";
	date: string;
	startTime: string;
	endTime: string;
	location?: string;
	description?: string;
	callTime?: string;
	performerIds?: string[];
	timezone: string;
	groupId: string;
	createdAt: string;
};

const STORAGE_KEY = "greenroom_draft_events";

export function getDraftEvents(groupId: string): DraftEvent[] {
	if (typeof window === "undefined") return [];
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) return [];
	try {
		const all = JSON.parse(stored) as DraftEvent[];
		return all.filter((d) => d.groupId === groupId);
	} catch {
		return [];
	}
}

export function getAllDraftEvents(): DraftEvent[] {
	if (typeof window === "undefined") return [];
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) return [];
	try {
		return JSON.parse(stored) as DraftEvent[];
	} catch {
		return [];
	}
}

export function saveDraftEvent(draft: Omit<DraftEvent, "id" | "createdAt">): DraftEvent {
	const all = getAllDraftEvents();
	const newDraft: DraftEvent = {
		...draft,
		id: crypto.randomUUID(),
		createdAt: new Date().toISOString(),
	};
	all.push(newDraft);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
	return newDraft;
}

export function updateDraftEvent(id: string, updates: Partial<DraftEvent>): void {
	const all = getAllDraftEvents();
	const index = all.findIndex((d) => d.id === id);
	if (index === -1) return;
	all[index] = { ...all[index], ...updates };
	localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteDraftEvent(id: string): void {
	const all = getAllDraftEvents();
	const filtered = all.filter((d) => d.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function deleteDraftEvents(ids: string[]): void {
	const all = getAllDraftEvents();
	const filtered = all.filter((d) => !ids.includes(d.id));
	localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getDraftCount(groupId: string): number {
	return getDraftEvents(groupId).length;
}
