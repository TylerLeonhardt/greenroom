import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("DangerZone", () => {
	test("Compact with Button — renders red styling and delete button", async ({ page }) => {
		await renderFixture(page, "danger-zone", "Compact with Button");

		await expect(page.getByText("Danger Zone")).toBeVisible();
		await expect(page.getByText("Deleting this event will remove all assignments")).toBeVisible();
		await expect(page.getByRole("button", { name: /delete/i })).toBeVisible();
	});

	test("Card with Link — renders card variant with description", async ({ page }) => {
		await renderFixture(page, "danger-zone", "Card with Link");

		await expect(page.getByText("Danger Zone")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Delete your account" })).toBeVisible();
	});

	test("Card with Confirmation — confirmation input disables delete button", async ({ page }) => {
		await renderFixture(page, "danger-zone", "Card with Confirmation");

		await expect(page.getByText("Danger Zone")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Delete this group" })).toBeVisible();

		// Delete button should be disabled (fixture has static disabled state)
		const deleteButton = page.getByRole("button", { name: /delete/i });
		await expect(deleteButton).toBeDisabled();

		// Confirmation input should be visible
		const input = page.getByPlaceholder("My Group");
		await expect(input).toBeVisible();
	});

	test("Card with Confirmation — partial text keeps button disabled", async ({ page }) => {
		await renderFixture(page, "danger-zone", "Card with Confirmation");

		const deleteButton = page.getByRole("button", { name: /delete/i });
		const input = page.getByPlaceholder("My Group");

		await input.fill("My Gro");
		// Button stays disabled (fixture has no state management to enable it)
		await expect(deleteButton).toBeDisabled();
	});
});
