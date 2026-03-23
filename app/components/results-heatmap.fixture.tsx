import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { ResultsHeatmap } from "./results-heatmap";
import "~/tailwind.css";

interface DateResult {
	date: string;
	available: number;
	maybe: number;
	notAvailable: number;
	noResponse: number;
	total: number;
	score: number;
	respondents: Array<{ name: string; status: string }>;
}

function makeDateResult(
	date: string,
	available: number,
	maybe: number,
	notAvailable: number,
	total: number,
	respondents: Array<{ name: string; status: string }>,
): DateResult {
	return {
		date,
		available,
		maybe,
		notAvailable,
		noResponse: total - available - maybe - notAvailable,
		total,
		score: available * 2 + maybe,
		respondents,
	};
}

const allRespondents = [
	{ name: "Alex", status: "available" },
	{ name: "Jordan", status: "available" },
	{ name: "Casey", status: "maybe" },
	{ name: "Morgan", status: "not_available" },
	{ name: "Riley", status: "available" },
	{ name: "Taylor", status: "available" },
	{ name: "Sam", status: "maybe" },
	{ name: "Drew", status: "not_available" },
];

const richDates: DateResult[] = [
	makeDateResult("2026-03-23", 5, 1, 1, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "available" },
		{ name: "Casey", status: "available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "available" },
		{ name: "Sam", status: "maybe" },
	]),
	makeDateResult("2026-03-24", 3, 2, 2, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "maybe" },
		{ name: "Casey", status: "not_available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "available" },
		{ name: "Sam", status: "maybe" },
	]),
	makeDateResult("2026-03-25", 6, 0, 1, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "available" },
		{ name: "Casey", status: "available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "available" },
		{ name: "Sam", status: "available" },
	]),
	makeDateResult("2026-03-26", 2, 1, 3, 8, [
		{ name: "Alex", status: "not_available" },
		{ name: "Jordan", status: "available" },
		{ name: "Casey", status: "not_available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "maybe" },
	]),
	makeDateResult("2026-03-27", 4, 2, 1, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "available" },
		{ name: "Casey", status: "maybe" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "available" },
		{ name: "Sam", status: "maybe" },
	]),
	makeDateResult("2026-03-28", 1, 1, 4, 8, [
		{ name: "Alex", status: "not_available" },
		{ name: "Jordan", status: "not_available" },
		{ name: "Casey", status: "maybe" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "not_available" },
	]),
	makeDateResult("2026-03-29", 5, 1, 0, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "available" },
		{ name: "Casey", status: "available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "available" },
		{ name: "Sam", status: "maybe" },
	]),
];

const highAvailDates: DateResult[] = [
	makeDateResult(
		"2026-03-23",
		7,
		1,
		0,
		8,
		allRespondents.map((r) => ({ ...r, status: "available" })),
	),
	makeDateResult(
		"2026-03-24",
		6,
		2,
		0,
		8,
		allRespondents.map((r, i) => ({
			...r,
			status: i < 6 ? "available" : "maybe",
		})),
	),
	makeDateResult(
		"2026-03-25",
		8,
		0,
		0,
		8,
		allRespondents.map((r) => ({ ...r, status: "available" })),
	),
	makeDateResult(
		"2026-03-26",
		7,
		0,
		1,
		8,
		allRespondents.map((r, i) => ({
			...r,
			status: i === 3 ? "not_available" : "available",
		})),
	),
	makeDateResult(
		"2026-03-27",
		6,
		1,
		1,
		8,
		allRespondents.map((r, i) => ({
			...r,
			status: i === 3 ? "not_available" : i === 6 ? "maybe" : "available",
		})),
	),
];

const lowAvailDates: DateResult[] = [
	makeDateResult("2026-03-23", 1, 1, 5, 8, [
		{ name: "Alex", status: "not_available" },
		{ name: "Jordan", status: "not_available" },
		{ name: "Casey", status: "maybe" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "not_available" },
		{ name: "Sam", status: "not_available" },
	]),
	makeDateResult("2026-03-24", 0, 2, 5, 8, [
		{ name: "Alex", status: "not_available" },
		{ name: "Jordan", status: "maybe" },
		{ name: "Casey", status: "not_available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "not_available" },
		{ name: "Taylor", status: "maybe" },
		{ name: "Sam", status: "not_available" },
	]),
	makeDateResult("2026-03-25", 1, 0, 6, 8, [
		{ name: "Alex", status: "not_available" },
		{ name: "Jordan", status: "not_available" },
		{ name: "Casey", status: "not_available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "not_available" },
		{ name: "Sam", status: "not_available" },
	]),
	makeDateResult("2026-03-26", 0, 1, 6, 8, [
		{ name: "Alex", status: "not_available" },
		{ name: "Jordan", status: "not_available" },
		{ name: "Casey", status: "not_available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "not_available" },
		{ name: "Taylor", status: "maybe" },
		{ name: "Sam", status: "not_available" },
	]),
	makeDateResult("2026-03-27", 2, 0, 5, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "not_available" },
		{ name: "Casey", status: "not_available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "not_available" },
		{ name: "Sam", status: "not_available" },
	]),
];

const timeRangeDates: DateResult[] = [
	makeDateResult("2026-03-23", 5, 1, 1, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "available" },
		{ name: "Casey", status: "maybe" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "available" },
		{ name: "Sam", status: "available" },
	]),
	makeDateResult("2026-03-25", 3, 2, 2, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "maybe" },
		{ name: "Casey", status: "not_available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "available" },
		{ name: "Sam", status: "maybe" },
	]),
	makeDateResult("2026-03-27", 4, 1, 2, 8, [
		{ name: "Alex", status: "available" },
		{ name: "Jordan", status: "available" },
		{ name: "Casey", status: "not_available" },
		{ name: "Morgan", status: "not_available" },
		{ name: "Riley", status: "available" },
		{ name: "Taylor", status: "available" },
		{ name: "Sam", status: "maybe" },
	]),
];

export default defineFixtureGroup({
	Interactive: defineFixture({
		description: "Results heatmap with configurable members, responses, and modes",
		properties: [
			{ type: "number", name: "totalMembers", defaultValue: 8 },
			{ type: "number", name: "totalResponded", defaultValue: 6 },
			{ type: "boolean", name: "showTimeRange", defaultValue: true },
			{ type: "boolean", name: "batchMode", defaultValue: false },
		],
		render: (container, { props }) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-4xl p-4">
					<ResultsHeatmap
						dates={richDates}
						totalMembers={props.totalMembers as number}
						totalResponded={props.totalResponded as number}
						groupId="fixture-group-1"
						requestId="fixture-request-1"
						timeRange={props.showTimeRange ? "7:00 PM - 9:00 PM" : null}
						timezone="America/New_York"
						batchMode={props.batchMode as boolean}
						onBatchCreate={(dates) => console.log("Batch create:", dates)}
					/>
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"High Availability": defineFixture({
		description: "All dates have high availability scores — emerald heatmap",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-4xl p-4">
					<ResultsHeatmap
						dates={highAvailDates}
						totalMembers={8}
						totalResponded={8}
						groupId="fixture-group-1"
						requestId="fixture-request-2"
						timezone="America/New_York"
					/>
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Low Availability": defineFixture({
		description: "Most members unavailable — rose heatmap colors",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-4xl p-4">
					<ResultsHeatmap
						dates={lowAvailDates}
						totalMembers={8}
						totalResponded={7}
						groupId="fixture-group-1"
						requestId="fixture-request-3"
						timezone="America/New_York"
					/>
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Batch Mode": defineFixture({
		description: "Batch event creation mode with selection controls",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-4xl p-4">
					<ResultsHeatmap
						dates={richDates}
						totalMembers={8}
						totalResponded={6}
						groupId="fixture-group-1"
						requestId="fixture-request-4"
						timezone="America/New_York"
						batchMode={true}
						onBatchCreate={(dates) => console.log("Batch create:", dates)}
					/>
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Empty Results": defineFixture({
		description: "No dates — empty state",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-4xl p-4">
					<ResultsHeatmap
						dates={[]}
						totalMembers={8}
						totalResponded={0}
						groupId="fixture-group-1"
						timezone="America/New_York"
					/>
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"With Time Range": defineFixture({
		description: "Displays the time range indicator with mixed availability",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-4xl p-4">
					<ResultsHeatmap
						dates={timeRangeDates}
						totalMembers={8}
						totalResponded={7}
						groupId="fixture-group-1"
						requestId="fixture-request-5"
						timeRange="7:00 PM - 9:00 PM"
						timezone="America/New_York"
					/>
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
});
