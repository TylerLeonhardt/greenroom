import path from "node:path";
import { vitePlugin as remix } from "@remix-run/dev";
import tailwindcss from "@tailwindcss/vite";
import { componentExplorer } from "@vscode/component-explorer-vite-plugin";
import { defineConfig } from "vite";

declare module "@remix-run/node" {
	interface Future {
		v3_singleFetch: true;
	}
}

export default defineConfig({
	cacheDir: process.env.E2E_VITE_CACHE_DIR,
	optimizeDeps: {
		include: [
			"@remix-run/react",
			"lucide-react",
			"react",
			"react-dom",
			"react/jsx-dev-runtime",
			"react/jsx-runtime",
		],
	},
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "app"),
		},
	},
	plugins: [
		tailwindcss(),
		remix({
			ignoredRouteFiles: ["**/*.test.{ts,tsx}", "**/*.fixture.{ts,tsx}"],
			future: {
				v3_fetcherPersist: true,
				v3_relativeSplatPath: true,
				v3_throwAbortReason: true,
				v3_singleFetch: true,
				v3_lazyRouteDiscovery: true,
			},
		}),
		componentExplorer({ include: "./app/**/*.fixture.{ts,tsx}" }),
	],
});
