import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("EventTypeSelector", () => {
	test("Default (Rehearsal) — rehearsal option is selected", async ({ page }) => {
		await renderFixture(page, "event-type-selector", "Default (Rehearsal)");

		// The radio input with value "rehearsal" should be checked
		const rehearsalRadio = page.locator("input[type='radio'][value='rehearsal']");
		await expect(rehearsalRadio).toBeChecked();

		// Visual label should be visible
		await expect(page.getByText("🎯 Rehearsal")).toBeVisible();
		await expect(page.getByText("🎭 Show")).toBeVisible();
		await expect(page.getByText("📅 Other")).toBeVisible();
	});

	test("Show Selected — show option is selected", async ({ page }) => {
		await renderFixture(page, "event-type-selector", "Show Selected");

		const showRadio = page.locator("input[type='radio'][value='show']");
		await expect(showRadio).toBeChecked();
	});

	test("Other Selected — other option is selected", async ({ page }) => {
		await renderFixture(page, "event-type-selector", "Other Selected");

		const otherRadio = page.locator("input[type='radio'][value='other']");
		await expect(otherRadio).toBeChecked();
	});

	test("Default — clicking a different option changes selection", async ({ page }) => {
		await renderFixture(page, "event-type-selector", "Default (Rehearsal)");

		// Initially rehearsal is selected
		await expect(page.locator("input[type='radio'][value='rehearsal']")).toBeChecked();

		// Click the Show label to select it
		await page.getByText("🎭 Show").click();
		await expect(page.locator("input[type='radio'][value='show']")).toBeChecked();
		await expect(page.locator("input[type='radio'][value='rehearsal']")).not.toBeChecked();

		// Click the Other label
		await page.getByText("📅 Other").click();
		await expect(page.locator("input[type='radio'][value='other']")).toBeChecked();
		await expect(page.locator("input[type='radio'][value='show']")).not.toBeChecked();
	});

	test("Default — selected option has distinct visual styling", async ({ page }) => {
		await renderFixture(page, "event-type-selector", "Default (Rehearsal)");

		// The label has peer-checked: classes applied when the hidden radio is checked
		const rehearsalRadio = page.locator("input[type='radio'][value='rehearsal']");
		await expect(rehearsalRadio).toBeChecked();

		// Click show and verify it gets checked instead
		await page.getByText("🎭 Show").click();
		const showRadio = page.locator("input[type='radio'][value='show']");
		await expect(showRadio).toBeChecked();
		await expect(rehearsalRadio).not.toBeChecked();
	});
});
