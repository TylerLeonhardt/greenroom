import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, type RouteObject, RouterProvider } from "react-router-dom";
import { PendingGroupCard } from "./pending-group-card";
import "~/tailwind.css";

function createRouter(element: React.ReactElement): ReturnType<typeof createMemoryRouter> {
	const routes: RouteObject[] = [
		{ path: "/", element },
		{ path: "/groups/:groupId/events", element: <div>Events page</div> },
	];
	return createMemoryRouter(routes);
}

export default defineFixtureGroup({
	Interactive: defineFixture({
		description: "Pending group confirmation card with configurable props",
		properties: [
			{ type: "string", name: "groupName", defaultValue: "Improv Comedy Group" },
			{ type: "number", name: "count", defaultValue: 3 },
		],
		render: (container, { props }) => {
			const root = createRoot(container);
			const router = createRouter(
				<div className="max-w-md">
					<PendingGroupCard
						groupId="fixture-group-1"
						groupName={props.groupName as string}
						count={props.count as number}
					/>
				</div>,
			);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Single Event": defineFixture({
		description: "Singular 'event needs' text when count is 1",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(
				<div className="max-w-md">
					<PendingGroupCard groupId="fixture-group-1" groupName="Thursday Night Jam" count={1} />
				</div>,
			);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Multiple Events": defineFixture({
		description: "Plural 'events need' text when count is greater than 1",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(
				<div className="max-w-md">
					<PendingGroupCard groupId="fixture-group-2" groupName="Weekend Warriors" count={5} />
				</div>,
			);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
});
