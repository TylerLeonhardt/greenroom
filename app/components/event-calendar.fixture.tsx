import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { EventCalendar } from "./event-calendar";
import "~/tailwind.css";

const sampleEvents = [
	{
		id: "e1",
		title: "Weekly Rehearsal",
		eventType: "rehearsal",
		startTime: "2026-03-10T14:00:00Z",
	},
	{
		id: "e2",
		title: "Weekly Rehearsal",
		eventType: "rehearsal",
		startTime: "2026-03-17T14:00:00Z",
	},
	{
		id: "e3",
		title: "Opening Night",
		eventType: "show",
		startTime: "2026-03-21T19:00:00Z",
	},
	{
		id: "e4",
		title: "Team Social",
		eventType: "other",
		startTime: "2026-03-25T18:00:00Z",
	},
	{
		id: "e5",
		title: "Closing Show",
		eventType: "show",
		startTime: "2026-03-28T19:00:00Z",
	},
	{
		id: "e6",
		title: "Spring Rehearsal",
		eventType: "rehearsal",
		startTime: "2026-04-02T14:00:00Z",
	},
];

export default defineFixtureGroup({
	"With Events": defineFixture({
		description: "Monthly calendar populated with rehearsals, shows, and other events",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-lg">
					<EventCalendar
						events={sampleEvents}
						onDateClick={(date, events) => console.log("Date clicked:", date, events)}
					/>
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Empty Calendar": defineFixture({
		description: "Calendar with no events scheduled",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-lg">
					<EventCalendar events={[]} />
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
});
