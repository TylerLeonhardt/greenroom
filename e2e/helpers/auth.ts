import type { Page } from "@playwright/test";
import type { TestUser } from "./seed";

/**
 * Log in a test user via the login form.
 * Navigates to /login, fills credentials, and waits for redirect to /dashboard.
 */
export async function loginAs(page: Page, user: TestUser): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("Email").fill(user.email);
	await page.getByLabel("Password").fill(user.password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL("**/dashboard");
}
