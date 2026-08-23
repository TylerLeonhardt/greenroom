import { expect, test } from "./helpers/fixtures";

test.describe("Create Group", () => {
	test.use({ authRole: "admin" });

	test("admin can create a new group", async ({ page }) => {
		await page.goto("/groups/new");
		await page.getByLabel("Name").fill(`New Group ${Date.now()}`);
		await page.getByLabel("Description").fill("Created by E2E test");
		await page.getByRole("button", { name: "Create Group" }).click();

		// Should redirect to the new group's overview page
		await expect(page).toHaveURL(/\/groups\/[a-f0-9-]+/);
		await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
	});
});

test.describe("Join Group", () => {
	test.use({ authRole: "solo" });

	test("user can join a group with invite code", async ({ page, testData }) => {
		await page.goto(`/groups/join?code=${testData.group.inviteCode}`);

		const codeInput = page.getByLabel(/code/i);
		await expect(codeInput).toHaveValue(testData.group.inviteCode);

		await page.getByRole("button", { name: "Join Group" }).click();

		// Should redirect to the group page after joining
		await expect(page).toHaveURL(/\/groups\/[a-f0-9-]+/);
	});
});

test.describe("Join Group Errors", () => {
	test.use({ authRole: "admin" });

	test("join page shows error for invalid invite code", async ({ page }) => {
		await page.goto("/groups/join");
		await page.getByLabel(/code/i).fill("ZZZZZZZZ");
		await page.getByRole("button", { name: "Join Group" }).click();

		await expect(page.getByText(/invalid|not found|no group/i)).toBeVisible();
	});
});

test.describe("Group Overview", () => {
	test.use({ authRole: "admin" });

	test("displays member list and group info", async ({ page, testData }) => {
		await page.goto(`/groups/${testData.group.id}`);

		await expect(page.getByText(testData.group.name)).toBeVisible();
		await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
		// Admin name appears in both nav and member list — scope to main content
		await expect(page.getByRole("main").getByText(testData.admin.name)).toBeVisible();
		await expect(page.getByRole("main").getByText(testData.member.name)).toBeVisible();
	});

	test("admin sees invite code on group page", async ({ page, testData }) => {
		await page.goto(`/groups/${testData.group.id}`);

		await expect(page.getByText(testData.group.inviteCode)).toBeVisible();
	});

	test("groups list page shows user's groups", async ({ page, testData }) => {
		await page.goto("/groups");

		await expect(page.getByText(testData.group.name)).toBeVisible();
	});
});
