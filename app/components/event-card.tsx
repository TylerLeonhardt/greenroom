import { Link } from "@remix-run/react";
import { CalendarDays, Check, MapPin, Users } from "lucide-react";
import { formatEventTime } from "~/lib/date-utils";

interface EventCardProps {
	id: string;
	groupId: string;
	title: string;
	eventType: string;
	startTime: string;
	endTime: string;
	location?: string | null;
	assignmentCount?: number;
	confirmedCount?: number;
	userStatus?: string | null;
	groupName?: string;
	compact?: boolean;
}

const EVENT_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
	show: { emoji: "🎭", label: "Show", color: "bg-purple-100 text-purple-700" },
	rehearsal: { emoji: "🎯", label: "Rehearsal", color: "bg-emerald-100 text-emerald-700" },
	other: { emoji: "📅", label: "Other", color: "bg-slate-100 text-slate-700" },
};

export function EventCard({
	id,
	groupId,
	title,
	eventType,
	startTime,
	endTime,
	location,
	assignmentCount,
	confirmedCount,
	userStatus,
	groupName,
	compact,
}: EventCardProps) {
	const config = EVENT_TYPE_CONFIG[eventType] ?? EVENT_TYPE_CONFIG.other;

	return (
		<Link
			to={`/groups/${groupId}/events/${id}`}
			className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
						>
							{config.emoji} {config.label}
						</span>
						{groupName && <span className="truncate text-xs text-slate-400">{groupName}</span>}
					</div>
					<h3 className="mt-1.5 text-sm font-semibold text-slate-900 group-hover:text-emerald-600">
						{title}
					</h3>
					<div className="mt-1.5 space-y-1">
						<div className="flex items-center gap-1.5 text-xs text-slate-500">
							<CalendarDays className="h-3.5 w-3.5" />
							{formatEventTime(startTime, endTime)}
						</div>
						{location && (
							<div className="flex items-center gap-1.5 text-xs text-slate-500">
								<MapPin className="h-3.5 w-3.5" />
								{location}
							</div>
						)}
					</div>
				</div>
			</div>

			{!compact && (
				<div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
					{assignmentCount !== undefined && (
						<div className="flex items-center gap-1.5 text-xs text-slate-500">
							<Users className="h-3.5 w-3.5" />
							{confirmedCount ?? 0}/{assignmentCount} confirmed
						</div>
					)}
					{userStatus && (
						<span
							className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
								userStatus === "confirmed"
									? "bg-emerald-100 text-emerald-700"
									: userStatus === "declined"
										? "bg-red-100 text-red-700"
										: "bg-amber-100 text-amber-700"
							}`}
						>
							{userStatus === "confirmed" && <Check className="h-3 w-3" />}
							{userStatus === "confirmed"
								? "Confirmed"
								: userStatus === "declined"
									? "Declined"
									: "Pending"}
						</span>
					)}
				</div>
			)}
		</Link>
	);
}
