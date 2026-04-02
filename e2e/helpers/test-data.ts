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

/**
 * Loads test data saved by global.setup.ts.
 *
 * Returns empty placeholders when the file doesn't exist yet. This happens
 * during Playwright's test-collection phase which evaluates all spec files
 * at module scope *before* the setup project runs. Worker processes
 * re-evaluate the files after setup completes, at which point the real
 * data is available.
 */
export function loadTestData(): SharedTestData {
	const path = "e2e/.auth/test-data.json";
	if (!fs.existsSync(path)) {
		return {
			admin: { id: "", email: "", name: "" },
			member: { id: "", email: "", name: "" },
			solo: { id: "", email: "", name: "" },
			group: { id: "", name: "", inviteCode: "" },
			availabilityRequest: { id: "", title: "", dates: [] },
		};
	}
	const raw = fs.readFileSync(path, "utf-8");
	return JSON.parse(raw);
}
