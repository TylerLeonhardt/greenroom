import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("InlineTimezoneSelector", () => {
	test("Interactive — renders timezone display", async ({ page }) => {
		await renderFixture(page, "timezone-selector", "Interactive");

		// Should show the default timezone label (New York)
		await expect(page.getByText(/New York/)).toBeVisible();
	});

	test("Interactive — click enters edit mode with select dropdown", async ({ page }) => {
		await renderFixture(page, "timezone-selector", "Interactive");

		// Click the timezone button to enter edit mode
		const timezoneButton = page.getByRole("button").filter({ hasText: /New York/ });
		await timezoneButton.click();

		// A select dropdown should appear
		const select = page.locator("select");
		await expect(select).toBeVisible();
	});

	test("Interactive — select a different timezone", async ({ page }) => {
		await renderFixture(page, "timezone-selector", "Interactive");

		// Enter edit mode
		const timezoneButton = page.getByRole("button").filter({ hasText: /New York/ });
		await timezoneButton.click();

		// A select dropdown should appear and we can change it
		const select = page.locator("select");
		await expect(select).toBeVisible();
		await select.selectOption("America/Los_Angeles");

		// The component auto-closes edit mode on change
		// Verify the select is no longer visible (edit mode closed)
		await expect(select).not.toBeVisible();
	});

	test("West Coast — shows Los Angeles timezone", async ({ page }) => {
		await renderFixture(page, "timezone-selector", "West Coast");

		await expect(page.getByText(/Los Angeles/)).toBeVisible();
	});

	test("International — shows Tokyo timezone", async ({ page }) => {
		await renderFixture(page, "timezone-selector", "International");

		await expect(page.getByText(/Tokyo/)).toBeVisible();
	});

	test("No Timezone — handles null timezone gracefully", async ({ page }) => {
		await renderFixture(page, "timezone-selector", "No Timezone");

		// Should render without crashing — the button or some fallback should be visible
		await expect(page.getByRole("button").first()).toBeVisible();
	});
});
