import { defineConfig, devices } from "@playwright/test";

const EXPLORER_PORT = 5337;
const APP_PORT = 5176;

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
	reporter: process.env.CI ? [["github"], ["html"]] : "html",
	use: {
		baseURL: process.env.E2E_BASE_URL || `http://localhost:${APP_PORT}`,
		screenshot: "only-on-failure",
		trace: "on-first-retry",
	},
	projects: [
		// ── App E2E Projects ──────────────────────────────────────────
		// Setup project — seeds DB and creates auth state files
		{
			name: "setup",
			testMatch: /global\.setup\.ts/,
		},
		// Browser projects — depend on setup
		// These use real user agents (no HeadlessChrome override) so that
		// E2E tests exercise the same handleBrowserRequest code path as
		// real users — including the StripSsrMarkers transform.
		{
			name: "Desktop Chrome",
			use: {
				...devices["Desktop Chrome"],
			},
			dependencies: ["setup"],
			testIgnore: ["**/helpers/**", "**/components/**"],
		},
		{
			name: "Mobile Safari",
			use: {
				...devices["iPhone 14"],
			},
			dependencies: ["setup"],
			testIgnore: ["**/helpers/**", "**/components/**"],
		},
		{
			name: "Mobile Chrome",
			use: {
				...devices["Pixel 7"],
			},
			dependencies: ["setup"],
			testIgnore: ["**/helpers/**", "**/components/**"],
		},

		// ── Component Explorer Projects ───────────────────────────────
		// Standalone tests for UI components via the component explorer.
		// No auth/DB setup needed — fixtures are self-contained.
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
	webServer: [
		{
			command: `pnpm run dev --port ${APP_PORT}`,
			port: APP_PORT,
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
		},
		{
			command: `pnpm vite dev --config vite.explorer.config.ts --port ${EXPLORER_PORT}`,
			port: EXPLORER_PORT,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
	],
});
