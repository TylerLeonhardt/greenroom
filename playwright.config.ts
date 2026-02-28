import { defineConfig, devices } from "@playwright/test";

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
		baseURL: process.env.E2E_BASE_URL || "http://localhost:5176",
		screenshot: "only-on-failure",
		trace: "on-first-retry",
	},
	projects: [
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
		},
		{
			name: "Mobile Safari",
			use: {
				...devices["iPhone 14"],
			},
			dependencies: ["setup"],
		},
		{
			name: "Mobile Chrome",
			use: {
				...devices["Pixel 7"],
			},
			dependencies: ["setup"],
		},
	],
	webServer: {
		command: "pnpm run dev -- --port 5176",
		port: 5176,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
});
