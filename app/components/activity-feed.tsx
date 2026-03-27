import { History } from "lucide-react";
import { formatDateTime } from "~/lib/date-utils";

const STATUS_LABELS: Record<string, string> = {
	confirmed: "Going",
	declined: "Not Going",
	pending: "Pending",
};

function formatStatusLabel(status: string): string {
	return STATUS_LABELS[status] ?? status;
}

export interface ActivityFeedEntry {
	id: string;
	userId: string;
	userName: string;
	previousStatus: "pending" | "confirmed" | "declined" | null;
	newStatus: "pending" | "confirmed" | "declined";
	changedAt: string | Date;
}

export interface ActivityFeedProps {
	entries: ActivityFeedEntry[];
	timezone?: string;
}

export function ActivityFeed({ entries, timezone }: ActivityFeedProps) {
	if (entries.length === 0) {
		return null;
	}

	return (
		<div className="mt-8">
			<h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
				<History className="h-4 w-4 text-slate-500" />
				Activity
			</h3>
			<div className="mt-3 space-y-0">
				{entries.map((entry) => (
					<div
						key={entry.id}
						className="flex items-start gap-3 border-l-2 border-slate-200 py-2 pl-4"
					>
						<div className="min-w-0 flex-1 text-sm text-slate-600">
							<span className="text-xs text-slate-400">
								{formatDateTime(entry.changedAt, timezone)}
							</span>
							<span className="mx-1.5">·</span>
							<span className="font-medium text-slate-900">{entry.userName}</span>{" "}
							{entry.previousStatus
								? `changed from ${formatStatusLabel(entry.previousStatus)} → ${formatStatusLabel(entry.newStatus)}`
								: `confirmed ${formatStatusLabel(entry.newStatus)}`}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
