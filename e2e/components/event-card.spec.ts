import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("EventCard", () => {
	test("Interactive — renders event title and details", async ({ page }) => {
		await renderFixture(page, "event-card", "Interactive");

		await expect(page.getByText("Friday Night Show")).toBeVisible();
		await expect(page.getByText("Main Theater")).toBeVisible();
	});

	test("Show Event — displays purple show badge", async ({ page }) => {
		await renderFixture(page, "event-card", "Show Event");

		await expect(page.getByText("🎭 Show")).toBeVisible();
		// Purple styling for show badge
		await expect(page.locator(".bg-purple-100")).toBeVisible();
	});

	test("Show Event — shows confirmation stats", async ({ page }) => {
		await renderFixture(page, "event-card", "Show Event");

		await expect(page.getByText(/confirmed/)).toBeVisible();
	});

	test("Rehearsal Event — displays emerald rehearsal badge", async ({ page }) => {
		await renderFixture(page, "event-card", "Rehearsal Event");

		await expect(page.getByText("🎯 Rehearsal")).toBeVisible();
		await expect(page.locator(".bg-emerald-100").first()).toBeVisible();
	});

	test("Compact — renders minimal card without stats", async ({ page }) => {
		await renderFixture(page, "event-card", "Compact");

		// Title should be visible
		const link = page.getByRole("link");
		await expect(link).toBeVisible();
	});

	test("Interactive — card is a navigable link", async ({ page }) => {
		await renderFixture(page, "event-card", "Interactive");

		// The card wraps in a Link component
		const link = page.getByRole("link");
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute("href", /\/groups\/.*\/events\//);
	});

	test("Show Event — shows user status indicator", async ({ page }) => {
		await renderFixture(page, "event-card", "Show Event");

		// Show event fixture should display a status indicator (confirmed/pending/declined)
		const statusIndicator = page.getByText(/Confirmed|Pending|Declined/);
		await expect(statusIndicator).toBeVisible();
	});
});
