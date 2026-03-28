import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { createRoot } from "react-dom/client";
import { ActivityFeed, type ActivityFeedEntry } from "./activity-feed";
import "~/tailwind.css";

const multipleEntries: ActivityFeedEntry[] = [
	{
		id: "entry-1",
		userId: "user-1",
		userName: "Alex Rivera",
		previousStatus: null,
		newStatus: "confirmed",
		changedAt: "2026-03-25T18:30:00Z",
	},
	{
		id: "entry-2",
		userId: "user-2",
		userName: "Jordan Lee",
		previousStatus: null,
		newStatus: "declined",
		changedAt: "2026-03-25T17:15:00Z",
	},
	{
		id: "entry-3",
		userId: "user-3",
		userName: "Casey Morgan",
		previousStatus: "confirmed",
		newStatus: "declined",
		changedAt: "2026-03-25T16:00:00Z",
	},
	{
		id: "entry-4",
		userId: "user-4",
		userName: "Riley Chen",
		previousStatus: "declined",
		newStatus: "confirmed",
		changedAt: "2026-03-24T22:45:00Z",
	},
	{
		id: "entry-5",
		userId: "user-5",
		userName: "Taylor Brooks",
		previousStatus: null,
		newStatus: "pending",
		changedAt: "2026-03-24T14:00:00Z",
	},
];

const singleEntry: ActivityFeedEntry[] = [
	{
		id: "entry-solo",
		userId: "user-1",
		userName: "Alex Rivera",
		previousStatus: null,
		newStatus: "confirmed",
		changedAt: "2026-03-27T19:00:00Z",
	},
];

export default defineFixtureGroup({
	"Multiple Entries": defineFixture({
		description: "Activity feed with several entries: new RSVPs, status changes, different users",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-lg p-4">
					<ActivityFeed entries={multipleEntries} timezone="America/New_York" />
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Empty Feed": defineFixture({
		description: "Activity feed with zero entries — renders nothing",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-lg p-4">
					<ActivityFeed entries={[]} timezone="America/New_York" />
					<p className="mt-4 text-sm text-slate-400 italic">
						(ActivityFeed returns null when entries is empty)
					</p>
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Single Entry": defineFixture({
		description: "Activity feed with one entry — first RSVP confirmation",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<div className="max-w-lg p-4">
					<ActivityFeed entries={singleEntry} timezone="America/New_York" />
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Status Changes Only": defineFixture({
		description: "Feed showing only status changes (no initial RSVPs)",
		render: (container) => {
			const root = createRoot(container);
			const statusChanges: ActivityFeedEntry[] = [
				{
					id: "change-1",
					userId: "user-1",
					userName: "Alex Rivera",
					previousStatus: "confirmed",
					newStatus: "declined",
					changedAt: "2026-03-26T20:00:00Z",
				},
				{
					id: "change-2",
					userId: "user-2",
					userName: "Jordan Lee",
					previousStatus: "pending",
					newStatus: "confirmed",
					changedAt: "2026-03-26T18:30:00Z",
				},
				{
					id: "change-3",
					userId: "user-3",
					userName: "Casey Morgan",
					previousStatus: "declined",
					newStatus: "confirmed",
					changedAt: "2026-03-26T15:00:00Z",
				},
			];
			root.render(
				<div className="max-w-lg p-4">
					<ActivityFeed entries={statusChanges} timezone="America/New_York" />
				</div>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
});
