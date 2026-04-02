import { defineConfig, devices } from "@playwright/test";

const EXPLORER_PORT = 5337;

/**
 * Standalone Playwright config for component explorer tests.
 *
 * Unlike the main playwright.config.ts which starts both the app dev server
 * (requires DB) and the explorer Vite server, this config only starts the
 * explorer server. This makes it safe to run in environments without a
 * database — perfect for CI and quick local component checks.
 *
 * Usage:
 *   pnpm test:e2e:explorer
 *   pnpm exec playwright test --config playwright.explorer.config.ts
 */
export default defineConfig({
	testDir: "./e2e",
	testIgnore: ["**/helpers/**"],
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "github" : "html",
	use: {
		screenshot: "only-on-failure",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "explorer:desktop",
			testMatch: "**/components/**/*.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				baseURL: `http://localhost:${EXPLORER_PORT}`,
			},
		},
		{
			name: "explorer:mobile",
			testMatch: "**/components/**/*.spec.ts",
			use: {
				...devices["Pixel 7"],
				baseURL: `http://localhost:${EXPLORER_PORT}`,
			},
		},
	],
	webServer: {
		command: `pnpm vite dev --config vite.explorer.config.ts --port ${EXPLORER_PORT}`,
		port: EXPLORER_PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
