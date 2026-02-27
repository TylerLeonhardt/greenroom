import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		globals: true,
		include: ["**/*.test.{ts,tsx}"],
	},
	resolve: {
		alias: {
			"~": new URL("./app", import.meta.url).pathname,
		},
	},
});
