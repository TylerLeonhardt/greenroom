import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { componentExplorer } from "@vscode/component-explorer-vite-plugin";
import { defineConfig } from "vite";

// Separate Vite config for the component explorer daemon.
// Excludes the Remix plugin which interferes with the explorer's
// preamble detection when rendering fixtures outside Remix routes.
export default defineConfig({
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "app"),
		},
	},
	plugins: [tailwindcss(), componentExplorer({ include: "./app/**/*.fixture.{ts,tsx}" })],
});
