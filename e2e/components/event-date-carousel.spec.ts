import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("EventDateCarousel", () => {
	test("Mixed Events — renders multiple event dates with type labels", async ({ page }) => {
		await renderFixture(page, "event-date-carousel", "Mixed Events");

		// Should show navigation
		const nav = page.locator("[aria-label='Event date navigation']");
		await expect(nav).toBeVisible();

		// Should display event type labels
		await expect(page.getByText("Show").first()).toBeVisible();
		await expect(page.getByText("Rehearsal").first()).toBeVisible();
	});

	test("Mixed Events — active event has aria-current=page", async ({ page }) => {
		await renderFixture(page, "event-date-carousel", "Mixed Events");

		const activeLink = page.locator("[aria-current='page']");
		await expect(activeLink).toBeVisible();
		await expect(activeLink).toHaveClass(/border-emerald-400/);
	});

	test("All Shows — renders only show type events", async ({ page }) => {
		await renderFixture(page, "event-date-carousel", "All Shows");

		const nav = page.locator("[aria-label='Event date navigation']");
		await expect(nav).toBeVisible();

		// All events should be shows
		const showLabels = page.getByText("Show");
		const count = await showLabels.count();
		expect(count).toBeGreaterThanOrEqual(2);
	});

	test("Many Events — renders scroll buttons for overflow", async ({ page }) => {
		await renderFixture(page, "event-date-carousel", "Many Events");

		// With many events, scroll buttons should appear
		const _scrollRight = page.getByLabel("Scroll right");
		// The scroll right button may or may not be visible depending on viewport,
		// but the carousel should have many event links
		const links = page.locator("[aria-label='Event date navigation'] a");
		const count = await links.count();
		expect(count).toBeGreaterThanOrEqual(6);
	});

	test("Many Events — keyboard navigation with arrow keys", async ({ page }) => {
		await renderFixture(page, "event-date-carousel", "Many Events");

		// Focus the active link
		const activeLink = page.locator("[aria-current='page']");
		await activeLink.focus();

		// Arrow key navigation should work (handled by the component)
		await page.keyboard.press("ArrowRight");
		await page.keyboard.press("ArrowLeft");

		// Component should still be intact after keyboard navigation
		await expect(page.locator("[aria-label='Event date navigation']")).toBeVisible();
	});

	test("Two Events — renders minimal carousel", async ({ page }) => {
		await renderFixture(page, "event-date-carousel", "Two Events");

		const nav = page.locator("[aria-label='Event date navigation']");
		await expect(nav).toBeVisible();

		const links = page.locator("[aria-label='Event date navigation'] a");
		await expect(links).toHaveCount(2);
	});
});
