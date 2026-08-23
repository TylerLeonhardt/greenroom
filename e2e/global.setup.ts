import fs from "node:fs";
import { test as setup } from "@playwright/test";
import { cleanupStaleTestData, seedStandaloneUser, seedTestData } from "./helpers/seed";
import {
	APP_PROJECTS,
	authStatePath,
	projectIp,
	testArtifactsPath,
	testDataPath,
	testNamespace,
} from "./helpers/test-data";

/**
 * Global setup: seed test data and save authenticated sessions.
 * Runs once before all test projects. Each browser project gets independent
 * records and storage state so mutations cannot leak into another project.
 */
setup("seed and authenticate", async ({ page }) => {
	setup.setTimeout(180_000);

	// Ensure auth directory exists (gitignored — absent on fresh clones and CI)
	fs.mkdirSync(testArtifactsPath(), { recursive: true });
	await cleanupStaleTestData();

	const browser = page.context().browser();
	if (!browser) throw new Error("Browser not available");
	const safeBrowser = browser;

	// Helper: log in a user and save auth state
	async function loginAndSave(
		email: string,
		password: string,
		statePath: string,
		projectName: string,
	) {
		const context = await safeBrowser.newContext({
			baseURL: process.env.E2E_BASE_URL || "http://localhost:5176",
			extraHTTPHeaders: { "x-forwarded-for": projectIp(projectName) },
		});
		const p = await context.newPage();
		await p.goto("/login");
		await p.waitForLoadState("networkidle");
		const passwordForm = p.getByRole("form", { name: "Sign in with password" });
		await passwordForm.getByLabel("Email", { exact: true }).fill(email);
		await passwordForm.getByLabel("Password", { exact: true }).fill(password);
		await passwordForm.getByRole("button", { name: "Sign in", exact: true }).click();
		await p.waitForURL("**/dashboard", { timeout: 15_000 });
		await context.storageState({ path: statePath });
		await context.close();
	}

	for (const projectName of APP_PROJECTS) {
		const prefix = testNamespace(projectName);
		const data = await seedTestData(prefix);
		const solo = await seedStandaloneUser(prefix);

		fs.writeFileSync(
			testDataPath(projectName),
			JSON.stringify({
				admin: { id: data.admin.id, email: data.admin.email, name: data.admin.name },
				member: { id: data.member.id, email: data.member.email, name: data.member.name },
				solo: { id: solo.user.id, email: solo.user.email, name: solo.user.name },
				group: { id: data.group.id, name: data.group.name, inviteCode: data.group.inviteCode },
				availabilityRequest: data.availabilityRequest,
				creatorAvailabilityRequest: data.creatorAvailabilityRequest,
				eventPermissionGroup: data.eventPermissionGroup,
				permissionAvailabilityRequest: data.permissionAvailabilityRequest,
				permissionCreatorAvailabilityRequest: data.permissionCreatorAvailabilityRequest,
			}),
		);

		await loginAndSave(
			data.admin.email,
			data.admin.password,
			authStatePath(projectName, "admin"),
			projectName,
		);
		await loginAndSave(
			data.member.email,
			data.member.password,
			authStatePath(projectName, "member"),
			projectName,
		);
		await loginAndSave(
			solo.user.email,
			solo.user.password,
			authStatePath(projectName, "solo"),
			projectName,
		);
	}
});
