export type GroupDecision =
	| { action: "transfer"; groupId: string; newAdminId: string }
	| { action: "delete"; groupId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: string[]): boolean {
	const keys = Object.keys(value);
	return keys.length === expectedKeys.length && expectedKeys.every((key) => keys.includes(key));
}

export function parseGroupDecisions(value: unknown): GroupDecision[] | null {
	if (!Array.isArray(value)) return null;

	const decisions: GroupDecision[] = [];
	const groupIds = new Set<string>();

	for (const candidate of value) {
		if (!isRecord(candidate) || typeof candidate.groupId !== "string" || !candidate.groupId) {
			return null;
		}
		if (groupIds.has(candidate.groupId)) return null;

		if (candidate.action === "delete") {
			if (!hasExactKeys(candidate, ["action", "groupId"])) return null;
			decisions.push({ action: "delete", groupId: candidate.groupId });
		} else if (candidate.action === "transfer") {
			if (
				!hasExactKeys(candidate, ["action", "groupId", "newAdminId"]) ||
				typeof candidate.newAdminId !== "string" ||
				!candidate.newAdminId
			) {
				return null;
			}
			decisions.push({
				action: "transfer",
				groupId: candidate.groupId,
				newAdminId: candidate.newAdminId,
			});
		} else {
			return null;
		}

		groupIds.add(candidate.groupId);
	}

	return decisions;
}
