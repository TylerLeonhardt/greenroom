import fs from "node:fs";

export const ADMIN_STATE = "e2e/.auth/admin.json";
export const MEMBER_STATE = "e2e/.auth/member.json";
export const SOLO_STATE = "e2e/.auth/solo.json";

export interface SharedTestData {
	admin: { id: string; email: string; name: string };
	member: { id: string; email: string; name: string };
	solo: { id: string; email: string; name: string };
	group: { id: string; name: string; inviteCode: string };
	availabilityRequest: { id: string; title: string; dates: string[] };
}

/** Loads test data saved by global.setup.ts */
export function loadTestData(): SharedTestData {
	const raw = fs.readFileSync("e2e/.auth/test-data.json", "utf-8");
	return JSON.parse(raw);
}
