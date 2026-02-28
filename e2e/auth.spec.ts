import { expect, test } from "@playwright/test";
import { ADMIN_STATE, loadTestData } from "./helpers/test-data";

const td = loadTestData();

test.describe("Signup", () => {
	test("shows validation errors for empty form", async ({ page }) => {
		await page.goto("/signup");

		await page.getByRole("button", { name: "Create account" }).click();

		// Should show validation errors — form stays on /signup
		await expect(page).toHaveURL(/\/signup/);
	});

	test("signup with valid credentials redirects to check-email", async ({ page }) => {
		const uniqueEmail = `e2e-signup-${Date.now()}@test.local`;

		await page.goto("/signup");
		await page.getByLabel("Name").fill("E2E Signup User");
		await page.getByLabel("Email").fill(uniqueEmail);
		await page.getByLabel("Password", { exact: true }).fill("SecurePass123!");
		await page.getByLabel("Confirm password").fill("SecurePass123!");
		await page.getByRole("button", { name: "Create account" }).click();

		// Should redirect to check-email page
		await expect(page).toHaveURL(/\/check-email/);
		await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
	});

	test("signup page shows password fields and Google OAuth option", async ({ page }) => {
		await page.goto("/signup");

		await expect(page.getByText("Create your account")).toBeVisible();
		await expect(page.getByLabel("Name")).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
		await expect(page.getByLabel("Confirm password")).toBeVisible();
		await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
		await expect(page.getByRole("link", { name: /google/i })).toBeVisible();
	});
});

test.describe("Login", () => {
	test("login with valid credentials redirects to dashboard", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill(td.admin.email);
		await page.getByLabel("Password").fill("TestPassword123!");
		await page.getByRole("button", { name: "Sign in" }).click();

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByText(/welcome back/i)).toBeVisible();
	});

	test("login with wrong password shows error", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill(td.admin.email);
		await page.getByLabel("Password").fill("WrongPassword999!");
		await page.getByRole("button", { name: "Sign in" }).click();

		// Should stay on login page and show error
		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByText(/invalid email or password/i)).toBeVisible();
	});

	test("login page shows email/password fields and Google OAuth", async ({ page }) => {
		await page.goto("/login");

		await expect(page.getByText("Welcome back")).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
		await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
		await expect(page.getByRole("link", { name: /google/i })).toBeVisible();
	});
});

test.describe("Logout", () => {
	test.use({ storageState: ADMIN_STATE });

	test("logout redirects to landing page", async ({ page, isMobile }) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		if (isMobile) {
			// On mobile, logout button is inside the hamburger menu
			await page.getByRole("button", { name: /toggle menu/i }).click();
		}

		await page.getByRole("button", { name: /log out/i }).click();

		// Should redirect to landing page
		await expect(page).toHaveURL("/");
		await expect(page.getByText("Never miss your call time")).toBeVisible();
	});
});

test.describe("Landing Page", () => {
	test("renders hero section with CTA buttons", async ({ page }) => {
		await page.goto("/");

		await expect(page.getByText("Never miss your call time")).toBeVisible();
		await expect(page.getByRole("link", { name: /get started free/i })).toBeVisible();
		await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
	});
});

test.describe("Landing Page (authenticated)", () => {
	test.use({ storageState: ADMIN_STATE });

	test("redirects to dashboard if already logged in", async ({ page }) => {
		await page.goto("/");

		await expect(page).toHaveURL(/\/dashboard/);
	});
});
