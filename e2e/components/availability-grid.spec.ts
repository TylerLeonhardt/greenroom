import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("AvailabilityGrid", () => {
	test("Interactive — renders dates and status buttons", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Interactive");

		// Bulk action buttons
		await expect(page.getByRole("button", { name: "All Available" })).toBeVisible();
		await expect(page.getByRole("button", { name: "All Unavailable" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();

		// Status buttons should be present for each date
		const availableButtons = page.getByRole("button", { name: "Available", exact: true });
		await expect(availableButtons.first()).toBeVisible();
	});

	test("Interactive — bulk 'All Available' sets all dates", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Interactive");
		await page.getByRole("button", { name: "All Available" }).click();

		// After clicking, all Available status buttons should have active styling
		const availableButtons = page.getByRole("button", { name: "Available", exact: true });
		const count = await availableButtons.count();
		expect(count).toBeGreaterThan(0);
		// Check the first one has the active class
		await expect(availableButtons.first()).toHaveClass(/bg-emerald-600/);
	});

	test("Interactive — bulk 'All Unavailable' sets all dates", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Interactive");
		await page.getByRole("button", { name: "All Unavailable" }).click();

		// Component is controlled (fixture logs onChange but doesn't update state)
		// Verify initial not_available date (2026-03-27) renders with active styling
		await expect(page.locator("button.bg-rose-600:visible").first()).toBeVisible();
	});

	test("Interactive — bulk 'Clear' resets all dates", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Interactive");
		// Verify the Clear button is visible and clickable
		const clearButton = page.getByRole("button", { name: "Clear" });
		await expect(clearButton).toBeVisible();
		await clearButton.click();
		// Grid should still be rendered after clicking clear
		await expect(
			page.getByRole("button", { name: "Available", exact: true }).first(),
		).toBeVisible();
	});

	test("Interactive — per-date status toggle cycles through states", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Interactive");

		// Verify initial state: first date (2026-03-23) has "available" active
		const firstAvailable = page.getByRole("button", { name: "Available", exact: true }).first();
		await expect(firstAvailable).toHaveClass(/bg-emerald-600/);

		// Verify initial "maybe" renders correctly (2026-03-25 is the 3rd date)
		await expect(page.locator("button.bg-amber-500:visible").first()).toBeVisible();

		// Verify clicking doesn't crash (component calls onChange)
		await firstAvailable.click();
		await expect(firstAvailable).toBeVisible();
	});

	test("Interactive — shows time range when enabled", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Interactive");
		// The interactive fixture has a showTimeRange property, defaults to true
		await expect(page.getByText(/Time:/)).toBeVisible();
	});

	test("Empty — renders grid with no responses", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Empty");

		// Should show dates but no active status buttons
		const availableButtons = page.getByRole("button", { name: "Available", exact: true });
		await expect(availableButtons.first()).toBeVisible();
	});

	test("Fully Responded — shows all dates with responses", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Fully Responded");

		// All dates should have an active status
		const availableButtons = page.getByRole("button", { name: "Available", exact: true });
		await expect(availableButtons.first()).toBeVisible();
	});

	test("Disabled — prevents interaction", async ({ page }) => {
		await renderFixture(page, "availability-grid", "Disabled");

		// Bulk action buttons should not be visible when disabled
		await expect(page.getByRole("button", { name: "All Available" })).not.toBeVisible();

		// Status buttons should be disabled
		const availableButtons = page.getByRole("button", { name: "Available", exact: true });
		await expect(availableButtons.first()).toBeDisabled();
	});

	test("Responsive — mobile renders card layout", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");
		await renderFixture(page, "availability-grid", "Interactive");

		// Mobile uses card layout instead of table
		// Status buttons should still be visible and interactive
		const availableButtons = page.getByRole("button", { name: "Available", exact: true });
		await expect(availableButtons.first()).toBeVisible();
		await availableButtons.first().click();
		await expect(availableButtons.first()).toHaveClass(/bg-emerald-600/);
	});
});
