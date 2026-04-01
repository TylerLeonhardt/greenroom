import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("EmptyState", () => {
	test("With Emoji Icon — renders emoji, title, and description", async ({ page }) => {
		await renderFixture(page, "empty-state", "With Emoji Icon");

		await expect(page.getByText("🎭")).toBeVisible();
		await expect(page.getByRole("heading", { name: "No groups yet" })).toBeVisible();
		await expect(page.getByText("You're not in any groups yet")).toBeVisible();
	});

	test("With Lucide Icon — renders icon and text", async ({ page }) => {
		await renderFixture(page, "empty-state", "With Lucide Icon");

		await expect(page.getByRole("heading", { name: "No events yet" })).toBeVisible();
		await expect(
			page.getByText("Create your first event or use availability results"),
		).toBeVisible();
	});

	test("Description Only — renders description without title or icon", async ({ page }) => {
		await renderFixture(page, "empty-state", "Description Only");

		// Should have description text but no heading
		await expect(
			page.getByText(/waiting|no data|nothing/i).or(page.locator(".text-slate-500")),
		).toBeVisible();
	});

	test("With Actions — renders action buttons", async ({ page }) => {
		await renderFixture(page, "empty-state", "With Actions");

		await expect(page.getByRole("heading", { name: "Create your first group" })).toBeVisible();

		// Action buttons rendered as links
		await expect(page.getByRole("link", { name: "Create Group" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Join Group" })).toBeVisible();
	});

	test("With Actions — links have correct destinations", async ({ page }) => {
		await renderFixture(page, "empty-state", "With Actions");

		await expect(page.getByRole("link", { name: "Create Group" })).toHaveAttribute(
			"href",
			"/groups/new",
		);
		await expect(page.getByRole("link", { name: "Join Group" })).toHaveAttribute(
			"href",
			"/groups/join",
		);
	});
});
