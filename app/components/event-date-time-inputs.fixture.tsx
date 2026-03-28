import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { EventDateTimeInputs } from "./event-date-time-inputs";
import "~/tailwind.css";

function Wrapper({ isShow, defaultDate }: { isShow: boolean; defaultDate?: string }) {
	const [timezone, setTimezone] = useState("America/New_York");
	return (
		<EventDateTimeInputs
			defaultDate={defaultDate}
			timezone={timezone}
			onTimezoneChange={setTimezone}
			isShow={isShow}
		/>
	);
}

export default defineFixtureGroup({
	"Default (Rehearsal)": defineFixture({
		description: "Date/time inputs for a rehearsal (no call time)",
		render: (container) => {
			const root = createRoot(container);
			root.render(<Wrapper isShow={false} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Show with Call Time": defineFixture({
		description: "Date/time inputs for a show event with call time field",
		render: (container) => {
			const root = createRoot(container);
			root.render(<Wrapper isShow={true} />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Prefilled (Edit Mode)": defineFixture({
		description: "Date/time inputs with prefilled values for editing",
		render: (container) => {
			const root = createRoot(container);
			root.render(<Wrapper isShow={true} defaultDate="2026-04-15" />);
			return { dispose: () => root.unmount() };
		},
	}),
});
