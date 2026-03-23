import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { DateSelector } from "./date-selector";
import "~/tailwind.css";

export default defineFixtureGroup({
	Interactive: defineFixture({
		description: "Two-month date selector with configurable date range",
		properties: [
			{ type: "string", name: "startDate", defaultValue: "2026-03-01" },
			{ type: "string", name: "endDate", defaultValue: "2026-04-30" },
		],
		render: (container, { props }) => {
			const root = createRoot(container);
			root.render(
				<DateSelector
					startDate={props.startDate as string}
					endDate={props.endDate as string}
					selectedDates={["2026-03-15", "2026-03-22", "2026-03-29"]}
					onChange={(dates) => console.log("Selected dates:", dates)}
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Single Month": defineFixture({
		description: "Date selector scoped to a single month with no pre-selection",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<DateSelector
					startDate="2026-03-01"
					endDate="2026-03-31"
					selectedDates={[]}
					onChange={(dates) => console.log("Selected dates:", dates)}
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Pre-selected Weekdays": defineFixture({
		description: "March weekdays pre-selected (Mon–Fri pattern)",
		render: (container) => {
			const weekdays: string[] = [];
			const start = new Date("2026-03-02");
			for (let i = 0; i < 27; i++) {
				const d = new Date(start);
				d.setDate(start.getDate() + i);
				if (d.getDay() !== 0 && d.getDay() !== 6) {
					weekdays.push(d.toISOString().split("T")[0]);
				}
			}
			const root = createRoot(container);
			root.render(
				<DateSelector
					startDate="2026-03-01"
					endDate="2026-03-31"
					selectedDates={weekdays}
					onChange={(dates) => console.log("Selected dates:", dates)}
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
});
