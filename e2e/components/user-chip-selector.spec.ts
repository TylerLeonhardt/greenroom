import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("UserChipSelector", () => {
	test("Emerald (Available) — renders user chips with emerald styling", async ({ page }) => {
		await renderFixture(page, "user-chip-selector", "Emerald (Available)");

		// User names should be visible
		await expect(page.getByText("Alice")).toBeVisible();
		await expect(page.getByText("Bob")).toBeVisible();
		await expect(page.getByText("Charlie")).toBeVisible();
		await expect(page.getByText("Diana")).toBeVisible();

		// Pre-selected chips (Alice & Charlie) should have emerald styling
		const aliceChip = page.locator("label", { hasText: "Alice" });
		await expect(aliceChip).toHaveClass(/bg-emerald-100/);
	});

	test("Emerald (Available) — click toggles chip selection", async ({ page }) => {
		await renderFixture(page, "user-chip-selector", "Emerald (Available)");

		// Bob starts unselected — click to select
		const bobChip = page.locator("label", { hasText: "Bob" });
		await expect(bobChip).not.toHaveClass(/bg-emerald-100/);

		await bobChip.click();
		await expect(bobChip).toHaveClass(/bg-emerald-100/);

		// Click again to deselect
		await bobChip.click();
		await expect(bobChip).not.toHaveClass(/bg-emerald-100/);
	});

	test("Amber (Maybe) — renders with amber color scheme", async ({ page }) => {
		await renderFixture(page, "user-chip-selector", "Amber (Maybe)");

		await expect(page.getByText("Alice")).toBeVisible();

		const aliceChip = page.locator("label", { hasText: "Alice" });
		await expect(aliceChip).toHaveClass(/bg-amber-100/);
	});

	test("Red Dimmed (Unavailable) — renders with red styling and dimmed opacity", async ({
		page,
	}) => {
		await renderFixture(page, "user-chip-selector", "Red Dimmed (Unavailable)");

		await expect(page.getByText("Alice")).toBeVisible();

		const aliceChip = page.locator("label", { hasText: "Alice" });
		await expect(aliceChip).toHaveClass(/bg-red-100/);
		await expect(aliceChip).toHaveClass(/opacity-60/);
	});

	test("Purple (No Availability Data) — renders with purple color scheme", async ({ page }) => {
		await renderFixture(page, "user-chip-selector", "Purple (No Availability Data)");

		await expect(page.getByText("Alice")).toBeVisible();

		const aliceChip = page.locator("label", { hasText: "Alice" });
		await expect(aliceChip).toHaveClass(/bg-purple-100/);
	});

	test("None Selected — all chips show unselected state", async ({ page }) => {
		await renderFixture(page, "user-chip-selector", "None Selected");

		await expect(page.getByText("Alice")).toBeVisible();
		await expect(page.getByText("Bob")).toBeVisible();

		// No chip should have the selected emerald background
		const aliceChip = page.locator("label", { hasText: "Alice" });
		await expect(aliceChip).not.toHaveClass(/bg-emerald-100/);
	});

	test("None Selected — clicking chip selects it", async ({ page }) => {
		await renderFixture(page, "user-chip-selector", "None Selected");

		const aliceChip = page.locator("label", { hasText: "Alice" });
		await expect(aliceChip).not.toHaveClass(/bg-emerald-100/);
		await aliceChip.click();
		await expect(aliceChip).toHaveClass(/bg-emerald-100/);
	});
});
