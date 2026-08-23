import { test as base, expect } from "@playwright/test";
import { type AuthRole, authStatePath, loadTestData, type SharedTestData } from "./test-data";

interface TestOptions {
	authRole: AuthRole | undefined;
}

interface WorkerFixtures {
	authStates: Record<AuthRole, string>;
	testData: SharedTestData;
}

export const test = base.extend<TestOptions, WorkerFixtures>({
	authRole: [undefined, { option: true }],
	authStates: [
		async ({ browserName }, use, testInfo) => {
			if (!browserName) throw new Error("Playwright browser name is required");
			await use({
				admin: authStatePath(testInfo.project.name, "admin"),
				member: authStatePath(testInfo.project.name, "member"),
				solo: authStatePath(testInfo.project.name, "solo"),
			});
		},
		{ scope: "worker" },
	],
	storageState: async ({ authRole }, use, testInfo) => {
		await use(authRole ? authStatePath(testInfo.project.name, authRole) : undefined);
	},
	testData: [
		async ({ browserName }, use, testInfo) => {
			if (!browserName) throw new Error("Playwright browser name is required");
			await use(loadTestData(testInfo.project.name));
		},
		{ scope: "worker" },
	],
});

export { expect };
