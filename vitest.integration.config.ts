import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["**/*.integration.test.ts"],
		env: {
			DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/greenroom_test",
			SESSION_SECRET: "test-secret-for-vitest",
		},
		globalSetup: ["./app/services/__integration__/global-setup.ts"],
		testTimeout: 30000,
		hookTimeout: 60000,
		fileParallelism: false,
		pool: "forks",
	},
	resolve: {
		alias: {
			"~": new URL("./app", import.meta.url).pathname,
		},
	},
});
