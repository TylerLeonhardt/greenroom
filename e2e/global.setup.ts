import fs from "node:fs";
import { test as setup } from "@playwright/test";
import { seedStandaloneUser, seedTestData } from "./helpers/seed";

const ADMIN_STATE = "e2e/.auth/admin.json";
const MEMBER_STATE = "e2e/.auth/member.json";
const SOLO_STATE = "e2e/.auth/solo.json";
const TEST_DATA_PATH = "e2e/.auth/test-data.json";

/**
 * Global setup: seed test data and save authenticated sessions.
 * Runs once before all test projects. Other tests reference the
 * saved storage state files to skip the login flow.
 */
setup("seed and authenticate", async ({ page }) => {
	setup.setTimeout(60_000);
	// Seed test data (shared across all projects)
	const data = await seedTestData("e2e");
	const solo = await seedStandaloneUser("e2e");

	// Save test data so spec files can access group IDs, names, etc.
	fs.writeFileSync(
		TEST_DATA_PATH,
		JSON.stringify({
			admin: { id: data.admin.id, email: data.admin.email, name: data.admin.name },
			member: { id: data.member.id, email: data.member.email, name: data.member.name },
			solo: { id: solo.user.id, email: solo.user.email, name: solo.user.name },
			group: { id: data.group.id, name: data.group.name, inviteCode: data.group.inviteCode },
			availabilityRequest: data.availabilityRequest,
		}),
	);

	const browser = page.context().browser();
	if (!browser) throw new Error("Browser not available");
	const safeBrowser = browser;

	// Helper: log in a user and save auth state
	async function loginAndSave(email: string, password: string, statePath: string) {
		const context = await safeBrowser.newContext();
		const p = await context.newPage();
		await p.goto("/login");
		await p.waitForLoadState("networkidle");
		await p.getByLabel("Email").fill(email);
		await p.getByLabel("Password").fill(password);
		await p.getByRole("button", { name: "Sign in" }).click();
		await p.waitForURL("**/dashboard", { timeout: 15_000 });
		await context.storageState({ path: statePath });
		await context.close();
	}

	await loginAndSave(data.admin.email, data.admin.password, ADMIN_STATE);
	await loginAndSave(data.member.email, data.member.password, MEMBER_STATE);
	await loginAndSave(solo.user.email, solo.user.password, SOLO_STATE);
});

export { ADMIN_STATE, MEMBER_STATE, SOLO_STATE, TEST_DATA_PATH };
