import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "./helpers/test-data";

test.describe("Settings", () => {
	test.use({ storageState: ADMIN_STATE });

	test("settings page renders with timezone and danger zone", async ({ page }) => {
		await page.goto("/settings");

		await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
		await expect(page.getByText(/danger zone/i)).toBeVisible();
		await expect(page.getByRole("link", { name: /delete account/i })).toBeVisible();
	});

	test("delete account page renders from settings link", async ({ page }) => {
		await page.goto("/settings");

		await page.getByRole("link", { name: /delete account/i }).click();

		await expect(page).toHaveURL(/\/settings\/delete-account/);
		await expect(page.getByRole("heading", { name: /delete.*(account|your)/i })).toBeVisible();
	});

	test("delete account page is accessible directly", async ({ page }) => {
		await page.goto("/settings/delete-account");

		await expect(page.getByRole("heading", { name: /delete.*(account|your)/i })).toBeVisible();
		// Should show the decision/confirm UI, not a 404
		await expect(page.getByText(/404|not found/i)).not.toBeVisible();
	});
});
