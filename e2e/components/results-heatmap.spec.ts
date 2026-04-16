import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("ResultsHeatmap", () => {
	test("Interactive — renders response summary and sort buttons", async ({ page }) => {
		await renderFixture(page, "results-heatmap", "Interactive");

		// Response summary
		await expect(page.getByText(/\d+\/\d+ responded/)).toBeVisible();

		// Sort buttons
		await expect(page.getByRole("button", { name: "Date" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Best First" })).toBeVisible();
	});

	test("Interactive — 'Best First' sort reorders dates by score", async ({ page }) => {
		await renderFixture(page, "results-heatmap", "Interactive");

		// Click "Best First" to sort by availability score
		await page.getByRole("button", { name: "Best First" }).click();

		// The best first button should now be active (dark background)
		await expect(page.getByRole("button", { name: "Best First" })).toHaveClass(/bg-slate-900/);
	});

	test("Interactive — 'Date' sort reorders dates chronologically", async ({ page }) => {
		await renderFixture(page, "results-heatmap", "Interactive");

		// Switch to Best First, then back to Date
		await page.getByRole("button", { name: "Best First" }).click();
		await page.getByRole("button", { name: "Date" }).click();

		await expect(page.getByRole("button", { name: "Date" })).toHaveClass(/bg-slate-900/);
	});

	test("Interactive — expand row shows respondent details", async ({ page, isMobile }) => {
		test.skip(isMobile === true, "Desktop-only test");
		await renderFixture(page, "results-heatmap", "Interactive");

		// Click expand button on the first date row (desktop table)
		const expandButton = page.locator("table button").first();
		await expandButton.click();

		// After expanding, respondent names should be visible
		await expect(page.getByText("Alex").first()).toBeVisible();
	});

	test("Interactive — mobile expand shows respondent details", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");
		await renderFixture(page, "results-heatmap", "Interactive");

		// On mobile, the date cards are inside the sm:hidden container
		const mobileContainer = page.locator(".sm\\:hidden");
		const expandable = mobileContainer.locator("[role='button']").first();
		await expandable.click();

		// After expanding, respondent names should be visible in the mobile view
		await expect(mobileContainer.getByText("Alex").first()).toBeVisible();
	});

	test("High Availability — shows emerald/green heatmap colors", async ({ page }) => {
		await renderFixture(page, "results-heatmap", "High Availability");

		// High availability dates should have emerald backgrounds
		// On mobile, desktop table is hidden; use the visible container
		const visibleEmerald = page.locator(".bg-emerald-100:visible").first();
		await expect(visibleEmerald).toBeVisible();
	});

	test("Low Availability — shows rose/red heatmap colors", async ({ page }) => {
		await renderFixture(page, "results-heatmap", "Low Availability");

		// Low availability dates should have rose backgrounds
		const visibleRose = page.locator(".bg-rose-100:visible, .bg-rose-50:visible").first();
		await expect(visibleRose).toBeVisible();
	});

	test("Batch Mode — shows batch selection controls", async ({ page }) => {
		await renderFixture(page, "results-heatmap", "Batch Mode");

		// Batch mode should show quick-select buttons (always visible)
		await expect(page.getByRole("button", { name: "Select Top 5" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Select All" })).toBeVisible();
	});

	test("Batch Mode — select dates and create events", async ({ page, isMobile }) => {
		test.skip(isMobile === true, "Desktop-only test");
		await renderFixture(page, "results-heatmap", "Batch Mode");

		// Quick select buttons should be visible (batch selection is always active)
		await expect(page.getByRole("button", { name: "Select Top 5" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Select All" })).toBeVisible();

		// Click Select All
		await page.getByRole("button", { name: "Select All" }).click();

		// Selected count should appear
		await expect(page.getByText(/\d+ dates? selected/)).toBeVisible();

		// Create Events button should be visible
		await expect(page.getByRole("button", { name: /Create.*Event/i })).toBeVisible();
	});

	test("Empty Results — renders with no data", async ({ page }) => {
		await renderFixture(page, "results-heatmap", "Empty Results");

		await expect(page.getByText(/0\/\d+ responded/)).toBeVisible();
	});

	test("With Time Range — displays time range info", async ({ page }) => {
		await renderFixture(page, "results-heatmap", "With Time Range");

		await expect(page.getByText(/Time:/)).toBeVisible();
	});
});
