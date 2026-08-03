import type { Page } from "@playwright/test";
import type { TestUser } from "./seed";

/**
 * Log in a test user via the login form.
 * Navigates to /login, fills credentials, and waits for redirect to /dashboard.
 */
export async function loginAs(page: Page, user: TestUser): Promise<void> {
	await page.goto("/login");
	const passwordForm = page.getByRole("form", { name: "Sign in with password" });
	await passwordForm.getByLabel("Email", { exact: true }).fill(user.email);
	await passwordForm.getByLabel("Password", { exact: true }).fill(user.password);
	await passwordForm.getByRole("button", { name: "Sign in", exact: true }).click();
	await page.waitForURL("**/dashboard");
}
