import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { EventDateCarousel } from "./event-date-carousel";
import "~/tailwind.css";

const mixedEvents = [
	{
		id: "e1",
		title: "Weekly Rehearsal",
		eventType: "rehearsal",
		startTime: "2026-03-10T14:00:00Z",
	},
	{ id: "e2", title: "Opening Night", eventType: "show", startTime: "2026-03-14T19:00:00Z" },
	{ id: "e3", title: "Team Workshop", eventType: "other", startTime: "2026-03-18T10:00:00Z" },
	{
		id: "e4",
		title: "Midweek Practice",
		eventType: "rehearsal",
		startTime: "2026-03-21T14:00:00Z",
	},
	{ id: "e5", title: "Saturday Show", eventType: "show", startTime: "2026-03-28T19:00:00Z" },
	{ id: "e6", title: "Closing Night", eventType: "show", startTime: "2026-03-30T19:00:00Z" },
];

const allShowEvents = [
	{ id: "s1", title: "Opening Night", eventType: "show", startTime: "2026-03-06T19:00:00Z" },
	{ id: "s2", title: "Weekend Matinee", eventType: "show", startTime: "2026-03-07T14:00:00Z" },
	{ id: "s3", title: "Friday Late Show", eventType: "show", startTime: "2026-03-13T21:00:00Z" },
	{ id: "s4", title: "Saturday Show", eventType: "show", startTime: "2026-03-14T19:00:00Z" },
	{ id: "s5", title: "Closing Night", eventType: "show", startTime: "2026-03-20T19:00:00Z" },
];

const manyEvents = [
	{ id: "m1", title: "Warm-Up Jam", eventType: "other", startTime: "2026-03-02T18:00:00Z" },
	{
		id: "m2",
		title: "Monday Rehearsal",
		eventType: "rehearsal",
		startTime: "2026-03-03T14:00:00Z",
	},
	{ id: "m3", title: "Wednesday Show", eventType: "show", startTime: "2026-03-05T19:00:00Z" },
	{ id: "m4", title: "Friday Practice", eventType: "rehearsal", startTime: "2026-03-07T14:00:00Z" },
	{ id: "m5", title: "Saturday Night", eventType: "show", startTime: "2026-03-08T20:00:00Z" },
	{ id: "m6", title: "Team Workshop", eventType: "other", startTime: "2026-03-12T10:00:00Z" },
	{ id: "m7", title: "Midweek Run", eventType: "rehearsal", startTime: "2026-03-14T14:00:00Z" },
	{ id: "m8", title: "Spring Show", eventType: "show", startTime: "2026-03-21T19:00:00Z" },
	{ id: "m9", title: "Tech Rehearsal", eventType: "rehearsal", startTime: "2026-03-28T14:00:00Z" },
	{ id: "m10", title: "Opening April", eventType: "show", startTime: "2026-04-03T19:00:00Z" },
	{ id: "m11", title: "April Practice", eventType: "rehearsal", startTime: "2026-04-07T14:00:00Z" },
	{ id: "m12", title: "April Showcase", eventType: "show", startTime: "2026-04-11T19:00:00Z" },
];

const twoEvents = [
	{ id: "t1", title: "First Rehearsal", eventType: "rehearsal", startTime: "2026-03-10T14:00:00Z" },
	{ id: "t2", title: "The Big Show", eventType: "show", startTime: "2026-03-14T19:00:00Z" },
];

export default defineFixtureGroup({
	"Mixed Events": defineFixture({
		description: "Carousel with a mix of show, rehearsal, and other event types",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<MemoryRouter>
					<div className="max-w-lg">
						<EventDateCarousel
							events={mixedEvents}
							currentEventId="e3"
							groupId="fixture-group-1"
							timezone="America/New_York"
						/>
					</div>
				</MemoryRouter>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"All Shows": defineFixture({
		description: "Carousel with only show events displaying purple styling",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<MemoryRouter>
					<div className="max-w-lg">
						<EventDateCarousel
							events={allShowEvents}
							currentEventId="s3"
							groupId="fixture-group-1"
							timezone="America/New_York"
						/>
					</div>
				</MemoryRouter>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Many Events": defineFixture({
		description: "Scroll stress test with 12 events across March–April 2026",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<MemoryRouter>
					<div className="max-w-lg">
						<EventDateCarousel
							events={manyEvents}
							currentEventId="m7"
							groupId="fixture-group-1"
							timezone="America/New_York"
						/>
					</div>
				</MemoryRouter>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Two Events": defineFixture({
		description: "Minimum carousel with exactly two events",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<MemoryRouter>
					<div className="max-w-lg">
						<EventDateCarousel
							events={twoEvents}
							currentEventId="t1"
							groupId="fixture-group-1"
							timezone="America/New_York"
						/>
					</div>
				</MemoryRouter>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
});
