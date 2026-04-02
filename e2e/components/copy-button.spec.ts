import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("CopyButton", () => {
	test("Icon Button — renders copy icon button", async ({ page }) => {
		await renderFixture(page, "copy-button", "Icon Button");

		const button = page.getByRole("button");
		await expect(button).toBeVisible();
	});

	test("Icon Button — click copies to clipboard and shows success state", async ({
		page,
		context,
	}) => {
		// Grant clipboard permissions
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		await renderFixture(page, "copy-button", "Icon Button");

		const button = page.getByRole("button");
		await button.click();

		// After clicking, the aria-label changes to "Copied!" and styles change to emerald
		await expect(button).toHaveAttribute("aria-label", "Copied!");
		await expect(button).toHaveClass(/border-emerald-300/);
	});

	test("Icon Button — resets after timeout", async ({ page, context }) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		await renderFixture(page, "copy-button", "Icon Button");

		const button = page.getByRole("button");
		await button.click();

		// Should show success state
		await expect(button).toHaveAttribute("aria-label", "Copied!");

		// Should reset after ~2 seconds
		await expect(button).not.toHaveAttribute("aria-label", "Copied!", { timeout: 5_000 });
	});

	test("Text Button — renders with label text", async ({ page }) => {
		await renderFixture(page, "copy-button", "Text Button");

		const button = page.getByRole("button", { name: /Copy Invite Link/i });
		await expect(button).toBeVisible();
	});

	test("Text Button — click shows 'Copied!' text", async ({ page, context }) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		await renderFixture(page, "copy-button", "Text Button");

		const button = page.getByRole("button", { name: /Copy Invite Link/i });
		await button.click();

		// Text should change to "Copied!"
		await expect(page.getByText("Copied!")).toBeVisible();
	});
});
