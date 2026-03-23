import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { AvailabilityGrid } from "./availability-grid";
import "~/tailwind.css";

type AvailabilityStatus = "available" | "maybe" | "not_available";

const sampleDates = [
	"2026-03-23",
	"2026-03-24",
	"2026-03-25",
	"2026-03-26",
	"2026-03-27",
	"2026-03-28",
	"2026-03-29",
];

export default defineFixtureGroup({
	Interactive: defineFixture({
		description: "Availability grid with configurable disabled state and time range",
		properties: [
			{ type: "boolean", name: "disabled", defaultValue: false },
			{ type: "boolean", name: "showTimeRange", defaultValue: true },
		],
		render: (container, { props }) => {
			const responses: Record<string, AvailabilityStatus> = {
				"2026-03-23": "available",
				"2026-03-25": "maybe",
				"2026-03-27": "not_available",
			};
			const root = createRoot(container);
			root.render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={responses}
					onChange={(r) => console.log("Responses changed:", r)}
					disabled={props.disabled as boolean}
					timeRange={(props.showTimeRange as boolean) ? "7:00 PM - 9:00 PM" : null}
					timezone="America/New_York"
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	Empty: defineFixture({
		description: "Blank grid with no responses selected",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={{}}
					onChange={(r) => console.log("Responses changed:", r)}
					timezone="America/New_York"
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Fully Responded": defineFixture({
		description: "Grid with all dates filled in across all three statuses",
		render: (container) => {
			const responses: Record<string, AvailabilityStatus> = {
				"2026-03-23": "available",
				"2026-03-24": "available",
				"2026-03-25": "maybe",
				"2026-03-26": "available",
				"2026-03-27": "not_available",
				"2026-03-28": "available",
				"2026-03-29": "maybe",
			};
			const root = createRoot(container);
			root.render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={responses}
					onChange={(r) => console.log("Responses changed:", r)}
					timeRange="7:00 PM - 9:00 PM"
					timezone="America/New_York"
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	Disabled: defineFixture({
		description: "Read-only grid (e.g. closed availability request)",
		render: (container) => {
			const responses: Record<string, AvailabilityStatus> = {
				"2026-03-23": "available",
				"2026-03-24": "maybe",
				"2026-03-25": "not_available",
			};
			const root = createRoot(container);
			root.render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={responses}
					onChange={() => {}}
					disabled
					timeRange="7:00 PM - 9:00 PM"
					timezone="America/New_York"
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
});
