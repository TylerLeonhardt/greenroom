import { expect, test } from "@playwright/test";
import { renderFixture } from "./fixture-url";

test.describe("GoogleAuthButton", () => {
	test("Sign In — renders 'Sign in with Google' text", async ({ page }) => {
		await renderFixture(page, "google-auth-button", "Sign In");

		await expect(page.getByText("Sign in with Google")).toBeVisible();
	});

	test("Sign In — links to Google auth endpoint", async ({ page }) => {
		await renderFixture(page, "google-auth-button", "Sign In");

		const link = page.getByRole("link", { name: /Sign in with Google/i });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute("href", "/auth/google");
	});

	test("Sign Up — renders 'Sign up with Google' text", async ({ page }) => {
		await renderFixture(page, "google-auth-button", "Sign Up");

		await expect(page.getByText("Sign up with Google")).toBeVisible();
	});

	test("Sign Up — links to Google auth endpoint", async ({ page }) => {
		await renderFixture(page, "google-auth-button", "Sign Up");

		const link = page.getByRole("link", { name: /Sign up with Google/i });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute("href", "/auth/google");
	});

	test("Sign In — renders Google icon (aria-hidden SVG)", async ({ page }) => {
		await renderFixture(page, "google-auth-button", "Sign In");

		const svg = page.locator("svg[aria-hidden='true']");
		await expect(svg).toBeVisible();
	});
});
