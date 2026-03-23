import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, type RouteObject, RouterProvider } from "react-router-dom";
import { InlineTimezoneSelector } from "./timezone-selector";
import "~/tailwind.css";

function createRouter(element: React.ReactElement): ReturnType<typeof createMemoryRouter> {
	const routes: RouteObject[] = [
		{ path: "/", element },
		{ path: "/settings", action: async () => ({ ok: true }) },
	];
	return createMemoryRouter(routes);
}

export default defineFixtureGroup({
	Interactive: defineFixture({
		description: "Interactive with configurable timezone",
		properties: [
			{
				type: "enum",
				name: "timezone",
				defaultValue: "America/New_York",
				options: [
					"America/New_York",
					"America/Chicago",
					"America/Denver",
					"America/Los_Angeles",
					"Europe/London",
					"Asia/Tokyo",
					"UTC",
				],
			},
		],
		render: (container, { props }) => {
			const root = createRoot(container);
			const router = createRouter(<InlineTimezoneSelector timezone={props.timezone as string} />);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"West Coast": defineFixture({
		description: "Pre-set to Pacific time",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(<InlineTimezoneSelector timezone="America/Los_Angeles" />);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	International: defineFixture({
		description: "Set to a non-US timezone",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(<InlineTimezoneSelector timezone="Asia/Tokyo" />);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"No Timezone": defineFixture({
		description: "Falls back to browser default",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(<InlineTimezoneSelector timezone={null} />);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
});
