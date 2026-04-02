import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("ActivityFeed", () => {
	test("Multiple Entries — renders user names and status changes", async ({ page }) => {
		await renderFixture(page, "activity-feed", "Multiple Entries");

		await expect(page.getByText("Activity").first()).toBeVisible();
		await expect(page.getByText("Alex Rivera")).toBeVisible();
		await expect(page.getByText("Jordan Lee")).toBeVisible();
		await expect(page.getByText("Casey Morgan")).toBeVisible();
	});

	test("Empty Feed — renders nothing", async ({ page }) => {
		await renderFixture(page, "activity-feed", "Empty Feed");

		// ActivityFeed returns null when entries is empty.
		// The fixture wrapper shows a description, but no ActivityFeed heading should exist.
		await expect(page.getByRole("heading", { name: "Activity" })).not.toBeVisible();
	});

	test("Single Entry — renders one activity entry", async ({ page }) => {
		await renderFixture(page, "activity-feed", "Single Entry");

		await expect(page.getByText("Activity")).toBeVisible();
		await expect(page.getByText("Alex Rivera")).toBeVisible();
	});

	test("Status Changes Only — renders change history", async ({ page }) => {
		await renderFixture(page, "activity-feed", "Status Changes Only");

		await expect(page.getByText("Activity").first()).toBeVisible();
		await expect(page.getByText("→").first()).toBeVisible();
	});
});
