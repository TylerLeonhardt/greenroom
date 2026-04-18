import { Link } from "@remix-run/react";

export interface PendingGroupCardProps {
	groupId: string;
	groupName: string;
	count: number;
}

export function PendingGroupCard({ groupId, groupName, count }: PendingGroupCardProps) {
	return (
		<Link
			to={`/groups/${groupId}/events`}
			className="block rounded-xl border-l-4 border-amber-400 bg-white p-4 shadow-sm transition-all hover:shadow-md"
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
						{count}
					</span>
					<div>
						<p className="text-sm font-semibold text-slate-900">{groupName}</p>
						<p className="text-xs text-slate-500">
							{count} {count === 1 ? "event needs" : "events need"} your confirmation
						</p>
					</div>
				</div>
				<span className="text-xs font-medium text-emerald-600">Confirm →</span>
			</div>
		</Link>
	);
}
