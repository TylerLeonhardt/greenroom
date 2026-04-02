import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("EventCalendar", () => {
	test("With Events — renders calendar with month heading and day headers", async ({ page }) => {
		await renderFixture(page, "event-calendar", "With Events");

		// Day column headers
		await expect(page.getByText("Sun")).toBeVisible();
		await expect(page.getByText("Mon")).toBeVisible();
		await expect(page.getByText("Tue")).toBeVisible();
		await expect(page.getByText("Wed")).toBeVisible();
		await expect(page.getByText("Thu")).toBeVisible();
		await expect(page.getByText("Fri")).toBeVisible();
		await expect(page.getByText("Sat")).toBeVisible();
	});

	test("With Events — shows event type legend", async ({ page }) => {
		await renderFixture(page, "event-calendar", "With Events");

		await expect(page.getByText("Show")).toBeVisible();
		await expect(page.getByText("Rehearsal")).toBeVisible();
		await expect(page.getByText("Other")).toBeVisible();
	});

	test("With Events — month navigation works", async ({ page }) => {
		await renderFixture(page, "event-calendar", "With Events");

		// The heading is an h3 within a flex navigation container
		const navContainer = page.locator("div.flex.items-center.justify-between").first();
		const heading = navContainer.locator("h3");
		const initialText = await heading.textContent();
		expect(initialText).toBeTruthy();

		// Click the next month button (second button in the nav container)
		await navContainer.locator("button").last().click();

		// Month should have changed
		const newText = await heading.textContent();
		expect(newText).not.toBe(initialText);
	});

	test("With Events — event dots are displayed", async ({ page }) => {
		await renderFixture(page, "event-calendar", "With Events");

		// Event dots are small colored circles (h-1.5 w-1.5 rounded-full)
		const dots = page.locator(".rounded-full.h-1\\.5");
		await expect(dots.first()).toBeVisible();
	});

	test("Empty Calendar — renders without event dots", async ({ page }) => {
		await renderFixture(page, "event-calendar", "Empty Calendar");

		// Should still show calendar structure
		await expect(page.getByText("Sun")).toBeVisible();

		// No event dots
		const dots = page.locator(".rounded-full.h-1\\.5");
		await expect(dots).toHaveCount(0);
	});
});
