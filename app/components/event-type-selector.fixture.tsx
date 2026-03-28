import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { EventTypeSelector } from "./event-type-selector";
import "~/tailwind.css";

export default defineFixtureGroup({
	"Default (Rehearsal)": defineFixture({
		description: "Event type selector defaulting to rehearsal",
		render: (container) => {
			const root = createRoot(container);
			root.render(<EventTypeSelector />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Show Selected": defineFixture({
		description: "Event type selector with show pre-selected",
		render: (container) => {
			const root = createRoot(container);
			root.render(<EventTypeSelector defaultValue="show" />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Other Selected": defineFixture({
		description: "Event type selector with other pre-selected",
		render: (container) => {
			const root = createRoot(container);
			root.render(<EventTypeSelector defaultValue="other" />);
			return { dispose: () => root.unmount() };
		},
	}),
});
