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
		// Note: We append "HeadlessChrome" to each user agent so the dev server's
		// entry.server.tsx routes requests through handleBotRequest (which skips
		// StripAfterHtmlEnd). In Vite dev mode, StripAfterHtmlEnd can strip the
		// entry client script from streamed chunks, preventing React hydration.
		// This does NOT affect production builds where scripts are bundled inline.
		{
			name: "Desktop Chrome",
			use: {
				...devices["Desktop Chrome"],
				userAgent: `${devices["Desktop Chrome"].userAgent} HeadlessChrome`,
			},
			dependencies: ["setup"],
		},
		{
			name: "Mobile Safari",
			use: {
				...devices["iPhone 14"],
				userAgent: `${devices["iPhone 14"].userAgent} HeadlessChrome`,
			},
			dependencies: ["setup"],
		},
		{
			name: "Mobile Chrome",
			use: {
				...devices["Pixel 7"],
				userAgent: `${devices["Pixel 7"].userAgent} HeadlessChrome`,
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
