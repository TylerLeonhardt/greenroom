import { Link, useFetcher } from "@remix-run/react";
import { CalendarDays, Check, MapPin, Users, X } from "lucide-react";
import { CsrfInput } from "~/components/csrf-input";
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
	timezone?: string | null;
	/** Set to true to show confirm/decline buttons when status is pending */
	showActions?: boolean;
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
	timezone,
	showActions,
}: EventCardProps) {
	const config = EVENT_TYPE_CONFIG[eventType] ?? EVENT_TYPE_CONFIG.other;
	const fetcher = useFetcher();

	// Optimistic UI: determine displayed status based on in-flight fetcher
	const optimisticIntent = fetcher.formData?.get("intent");
	const displayStatus = optimisticIntent
		? optimisticIntent === "confirm"
			? "confirmed"
			: "declined"
		: userStatus;
	const isPending = displayStatus === "pending" && showActions;

	return (
		<div className="group relative rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-200 hover:shadow-md">
			{/* Card content area */}
			<div className="p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<span
								className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
							>
								{config.emoji} {config.label}
							</span>
							{displayStatus === "pending" && showActions && (
								<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
									⏳ Pending
								</span>
							)}
							{groupName && <span className="truncate text-xs text-slate-400">{groupName}</span>}
						</div>
						{/* Title link uses stretched-link pattern for card-wide click area */}
						<Link to={`/groups/${groupId}/events/${id}`} className="after:absolute after:inset-0">
							<h3 className="mt-1.5 text-sm font-semibold text-slate-900 group-hover:text-emerald-600">
								{title}
							</h3>
						</Link>
						<div className="mt-1.5 space-y-1">
							<div className="flex items-center gap-1.5 text-xs text-slate-500">
								<CalendarDays className="h-3.5 w-3.5" />
								{formatEventTime(startTime, endTime, timezone ?? undefined)}
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
			</div>

			{!compact && (
				<div className="relative z-10 border-t border-slate-100 px-4 py-3">
					{isPending ? (
						<fetcher.Form method="post" action={`/groups/${groupId}/events/${id}`}>
							<CsrfInput />
							<div className="flex items-center gap-2">
								<button
									type="submit"
									name="intent"
									value="confirm"
									className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
								>
									<Check className="h-3 w-3" /> Confirm
								</button>
								<button
									type="submit"
									name="intent"
									value="decline"
									className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
								>
									<X className="h-3 w-3" /> Decline
								</button>
							</div>
						</fetcher.Form>
					) : (
						<div className="flex items-center justify-between">
							{assignmentCount !== undefined && (
								<div className="flex items-center gap-1.5 text-xs text-slate-500">
									<Users className="h-3.5 w-3.5" />
									{confirmedCount ?? 0}/{assignmentCount} confirmed
								</div>
							)}
							{displayStatus && (
								<span
									className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
										displayStatus === "confirmed"
											? "bg-emerald-100 text-emerald-700"
											: displayStatus === "declined"
												? "bg-red-100 text-red-700"
												: "bg-amber-100 text-amber-700"
									}`}
								>
									{displayStatus === "confirmed" && <Check className="h-3 w-3" />}
									{displayStatus === "confirmed"
										? "Confirmed"
										: displayStatus === "declined"
											? "Declined"
											: "Pending"}
								</span>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
