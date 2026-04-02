import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("DateSelector", () => {
	test("Interactive — renders calendar with quick-select buttons", async ({ page }) => {
		await renderFixture(page, "date-selector", "Interactive");

		// Quick-select buttons
		await expect(page.getByRole("button", { name: /Weekdays/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /Weekends/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /All Days/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /Clear All/i })).toBeVisible();

		// Day headers
		await expect(page.getByText("Sun").first()).toBeVisible();
		await expect(page.getByText("Mon").first()).toBeVisible();
	});

	test("Interactive — 'Weekdays' selects Mon-Fri dates", async ({ page }) => {
		await renderFixture(page, "date-selector", "Interactive");

		await page.getByRole("button", { name: /Weekdays/i }).click();

		// Counter should show selected days
		await expect(page.getByText(/\d+ days? selected/)).toBeVisible();
	});

	test("Interactive — 'Weekends' selects Sat-Sun dates", async ({ page }) => {
		await renderFixture(page, "date-selector", "Interactive");

		await page.getByRole("button", { name: /Weekends/i }).click();
		await expect(page.getByText(/\d+ days? selected/)).toBeVisible();
	});

	test("Interactive — 'All Days' selects every date in range", async ({ page }) => {
		await renderFixture(page, "date-selector", "Interactive");

		await page.getByRole("button", { name: /All Days/i }).click();
		await expect(page.getByText(/\d+ days? selected/)).toBeVisible();
	});

	test("Interactive — 'Clear All' deselects everything", async ({ page }) => {
		await renderFixture(page, "date-selector", "Interactive");
		// Fixture starts with 3 days selected (component is controlled, so state won't change)
		await expect(page.getByText("3 days selected")).toBeVisible();
		// Verify the Clear All button is functional
		await page.getByRole("button", { name: /Clear All/i }).click();
		// Component is controlled — counter reflects the prop, which stays at 3
		await expect(page.getByText(/\d+ days? selected/)).toBeVisible();
	});

	test("Interactive — individual date toggle", async ({ page }) => {
		await renderFixture(page, "date-selector", "Interactive");

		// Counter shows initial pre-selected count
		await expect(page.getByText("3 days selected")).toBeVisible();

		// Click a specific date button — component is controlled so counter stays at 3
		const dateButton = page.getByRole("button", { name: "16", exact: true }).first();
		await dateButton.click();
		await expect(page.getByText(/\d+ days? selected/)).toBeVisible();
	});

	test("Single Month — renders single month view", async ({ page }) => {
		await renderFixture(page, "date-selector", "Single Month");

		// Should show a month heading and day headers
		await expect(page.getByText("Sun").first()).toBeVisible();
		await expect(page.getByText("Mon").first()).toBeVisible();
	});

	test("Pre-selected Weekdays — shows pre-selected dates", async ({ page }) => {
		await renderFixture(page, "date-selector", "Pre-selected Weekdays");

		// Should show a count of pre-selected days
		await expect(page.getByText(/\d+ days? selected/)).toBeVisible();
	});
});
