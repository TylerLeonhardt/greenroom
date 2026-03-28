import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { type ChipColorScheme, UserChipSelector } from "./user-chip-selector";
import "~/tailwind.css";

const sampleUsers = [
	{ id: "1", name: "Alice" },
	{ id: "2", name: "Bob" },
	{ id: "3", name: "Charlie" },
	{ id: "4", name: "Diana" },
];

function Wrapper({
	colorScheme,
	dimmed,
	preSelected,
}: {
	colorScheme: ChipColorScheme;
	dimmed?: boolean;
	preSelected?: string[];
}) {
	const [selected, setSelected] = useState<Set<string>>(new Set(preSelected ?? ["1", "3"]));
	const toggle = (id: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	return (
		<UserChipSelector
			users={sampleUsers}
			selectedIds={selected}
			onToggle={toggle}
			colorScheme={colorScheme}
			dimmed={dimmed}
		/>
	);
}

export default defineFixtureGroup({
	"Emerald (Available)": defineFixture({
		description: "Green chips for available users",
		render: (container) => {
			const root = createRoot(container);
			root.render(<Wrapper colorScheme="emerald" />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Amber (Maybe)": defineFixture({
		description: "Amber chips for maybe users",
		render: (container) => {
			const root = createRoot(container);
			root.render(<Wrapper colorScheme="amber" />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Red Dimmed (Unavailable)": defineFixture({
		description: "Red dimmed chips for unavailable users",
		render: (container) => {
			const root = createRoot(container);
			root.render(<Wrapper colorScheme="red" dimmed />);
			return { dispose: () => root.unmount() };
		},
	}),
	"Purple (No Availability Data)": defineFixture({
		description: "Purple chips when no availability data exists",
		render: (container) => {
			const root = createRoot(container);
			root.render(<Wrapper colorScheme="purple" />);
			return { dispose: () => root.unmount() };
		},
	}),
	"None Selected": defineFixture({
		description: "All chips unselected",
		render: (container) => {
			const root = createRoot(container);
			root.render(<Wrapper colorScheme="emerald" preSelected={[]} />);
			return { dispose: () => root.unmount() };
		},
	}),
});
