import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { CalendarDays } from "lucide-react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { EmptyState } from "./empty-state";
import "~/tailwind.css";

export default defineFixtureGroup({
	"With Emoji Icon": defineFixture({
		description: "Empty state with emoji icon, title, and description",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<EmptyState
					icon="🎭"
					title="No groups yet"
					description="You're not in any groups yet. Create one or join with an invite code to get started."
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"With Lucide Icon": defineFixture({
		description: "Empty state with lucide-react icon",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<EmptyState
					icon={<CalendarDays className="mx-auto h-10 w-10 text-slate-300" />}
					title="No events yet"
					description="Create your first event or use availability results to schedule one."
				/>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Description Only": defineFixture({
		description: "Minimal empty state with just a description",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<EmptyState description="No upcoming events. Events will appear here when they're scheduled." />,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"With Actions": defineFixture({
		description: "Empty state with action buttons",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<MemoryRouter>
					<EmptyState
						icon="🎭"
						title="Create your first group"
						description="Get your ensemble together by creating a group or joining one with an invite code."
						actions={
							<>
								<a
									href="/groups/new"
									className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
								>
									Create Group
								</a>
								<a
									href="/groups/join"
									className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
								>
									Join Group
								</a>
							</>
						}
					/>
				</MemoryRouter>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
});
