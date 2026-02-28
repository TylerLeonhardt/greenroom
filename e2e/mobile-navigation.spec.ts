import { expect, test } from "@playwright/test";
import { ADMIN_STATE, loadTestData } from "./helpers/test-data";

const td = loadTestData();

test.describe("Hamburger Menu", () => {
	test.use({ storageState: ADMIN_STATE });

	test("hamburger menu button is visible on mobile", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");

		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		const menuButton = page.getByRole("button", { name: /toggle menu/i });
		await expect(menuButton).toBeVisible();
	});

	test("hamburger menu opens and shows nav links", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");

		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		// Open menu
		await page.getByRole("button", { name: /toggle menu/i }).click();

		// Nav links should be visible in the mobile menu
		await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Groups" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
	});

	test("navigation links work from hamburger menu", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");

		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		// Open menu and navigate to Groups
		await page.getByRole("button", { name: /toggle menu/i }).click();
		await page.getByRole("link", { name: "Groups" }).click();
		await expect(page).toHaveURL(/\/groups/);
	});
});

test.describe("Mobile Forms (unauthenticated)", () => {
	test("login form is usable on mobile viewport", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");

		await page.goto("/login");

		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
		await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
	});

	test("signup form is usable on mobile viewport", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");

		await page.goto("/signup");

		await expect(page.getByLabel("Name")).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
		await expect(page.getByLabel("Confirm password")).toBeVisible();
		await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
	});

	test("landing page hero section is visible on mobile", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");

		await page.goto("/");

		await expect(page.getByText("Never miss your call time")).toBeVisible();
		await expect(page.getByRole("link", { name: /get started free/i })).toBeVisible();
	});
});

test.describe("Mobile Pages (authenticated)", () => {
	test.use({ storageState: ADMIN_STATE });

	test("dashboard is functional on mobile", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");

		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		await expect(page.getByText(/welcome back/i)).toBeVisible();
	});

	test("group overview is functional on mobile", async ({ page, isMobile }) => {
		test.skip(!isMobile, "Mobile-only test");

		await page.goto(`/groups/${td.group.id}`);
		await page.waitForLoadState("networkidle");

		await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();
		await expect(page.getByRole("main").getByText(td.admin.name)).toBeVisible();
	});
});

test.describe("Desktop Navigation", () => {
	test.use({ storageState: ADMIN_STATE });

	test("desktop nav shows all links without hamburger", async ({ page, isMobile }) => {
		test.skip(isMobile === true, "Desktop-only test");

		await page.goto("/dashboard");

		await expect(page.getByRole("button", { name: /toggle menu/i })).not.toBeVisible();
		await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Groups" })).toBeVisible();
	});
});
