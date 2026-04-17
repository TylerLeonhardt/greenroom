import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, type RouteObject, RouterProvider } from "react-router-dom";
import { EventCard } from "./event-card";
import "~/tailwind.css";

// useFetcher() requires a data router context (createMemoryRouter + RouterProvider),
// not a basic <MemoryRouter>. A dummy action route handles fetcher form submissions.
function createRouter(element: React.ReactElement): ReturnType<typeof createMemoryRouter> {
	const routes: RouteObject[] = [
		{ path: "/", element },
		{ path: "/groups/:groupId/events/:eventId", action: async () => ({ ok: true }) },
	];
	return createMemoryRouter(routes);
}

export default defineFixtureGroup({
	Interactive: defineFixture({
		description: "Event card with configurable type, status, and layout",
		properties: [
			{ type: "string", name: "title", defaultValue: "Friday Night Show" },
			{
				type: "enum",
				name: "eventType",
				defaultValue: "show",
				options: ["show", "rehearsal", "other"],
			},
			{
				type: "enum",
				name: "userStatus",
				defaultValue: "confirmed",
				options: ["confirmed", "declined", "pending"],
			},
			{ type: "boolean", name: "compact", defaultValue: false },
			{ type: "boolean", name: "showActions", defaultValue: false },
			{ type: "string", name: "location", defaultValue: "Main Theater" },
		],
		render: (container, { props }) => {
			const root = createRoot(container);
			const router = createRouter(
				<div className="max-w-sm">
					<EventCard
						id="fixture-event-1"
						groupId="fixture-group-1"
						title={props.title as string}
						eventType={props.eventType as string}
						startTime="2026-03-25T19:00:00Z"
						endTime="2026-03-25T22:00:00Z"
						location={props.location as string}
						assignmentCount={12}
						confirmedCount={10}
						userStatus={props.userStatus as string}
						compact={props.compact as boolean}
						showActions={props.showActions as boolean}
						timezone="America/New_York"
					/>
				</div>,
			);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Show Event": defineFixture({
		description: "Purple-badged show event with confirmed status",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(
				<div className="max-w-sm">
					<EventCard
						id="fixture-show"
						groupId="fixture-group-1"
						title="Opening Night"
						eventType="show"
						startTime="2026-03-25T19:00:00Z"
						endTime="2026-03-25T22:00:00Z"
						location="Comedy Club Downtown"
						assignmentCount={8}
						confirmedCount={6}
						userStatus="confirmed"
						timezone="America/New_York"
					/>
				</div>,
			);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Rehearsal Event": defineFixture({
		description: "Emerald-badged rehearsal event",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(
				<div className="max-w-sm">
					<EventCard
						id="fixture-rehearsal"
						groupId="fixture-group-1"
						title="Weekly Practice"
						eventType="rehearsal"
						startTime="2026-03-22T14:00:00Z"
						endTime="2026-03-22T16:00:00Z"
						location="Studio B"
						assignmentCount={5}
						confirmedCount={5}
						userStatus="confirmed"
						timezone="America/New_York"
					/>
				</div>,
			);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	Compact: defineFixture({
		description: "Compact card variant without attendance stats",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(
				<div className="max-w-sm">
					<EventCard
						id="fixture-compact"
						groupId="fixture-group-1"
						title="Team Jam"
						eventType="other"
						startTime="2026-03-28T18:00:00Z"
						endTime="2026-03-28T20:00:00Z"
						compact
						timezone="America/New_York"
					/>
				</div>,
			);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Pending with Actions": defineFixture({
		description: "Pending assignment with inline confirm/decline buttons",
		render: (container) => {
			const root = createRoot(container);
			const router = createRouter(
				<div className="max-w-sm">
					<EventCard
						id="fixture-pending"
						groupId="fixture-group-1"
						title="Weekend Workshop"
						eventType="rehearsal"
						startTime="2026-04-05T10:00:00Z"
						endTime="2026-04-05T13:00:00Z"
						location="Studio A"
						assignmentCount={6}
						confirmedCount={3}
						userStatus="pending"
						showActions
						compact={false}
						timezone="America/New_York"
					/>
				</div>,
			);
			root.render(<RouterProvider router={router} />);
			return { dispose: () => root.unmount() };
		},
	}),
});
