import { defineFixture, defineFixtureGroup } from "@vscode/component-explorer";
import { AlertTriangle, Trash2 } from "lucide-react";
import { createRoot } from "react-dom/client";
import { DangerZone } from "./danger-zone";
import "~/tailwind.css";

export default defineFixtureGroup({
	"Compact with Button": defineFixture({
		description: "Compact danger zone with a destructive action button",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<DangerZone description="Deleting this event will remove all assignments and cannot be undone.">
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
					>
						<Trash2 className="h-4 w-4" /> Delete Event
					</button>
				</DangerZone>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Card with Link": defineFixture({
		description: "Card-style danger zone with icon and link action",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<DangerZone
					variant="card"
					icon={<AlertTriangle className="h-5 w-5" />}
					subtitle="Delete your account"
					description="Permanently delete your account and all associated data. You will have 30 days to reactivate your account by logging back in."
				>
					<a
						href="/settings/delete-account"
						className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
					>
						Delete Account
					</a>
				</DangerZone>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
	"Card with Confirmation": defineFixture({
		description: "Card-style danger zone requiring typed confirmation",
		render: (container) => {
			const root = createRoot(container);
			root.render(
				<DangerZone
					variant="card"
					subtitle="Delete this group"
					description="Deleting this group will permanently remove all members, availability requests, events, and assignments. This cannot be undone."
				>
					<div className="space-y-3">
						<div>
							<label htmlFor="confirmName" className="block text-sm font-medium text-slate-700">
								Type <span className="font-semibold">"My Group"</span> to confirm:
							</label>
							<input
								id="confirmName"
								type="text"
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm"
								placeholder="My Group"
							/>
						</div>
						<button
							type="button"
							disabled
							className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
						>
							Delete this group
						</button>
					</div>
				</DangerZone>,
			);
			return { dispose: () => root.unmount() };
		},
	}),
});
