import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { AlertCircle, CalendarDays, Clock, Plus, Users } from "lucide-react";
import { EventCard } from "~/components/event-card";
import { formatDateShort } from "~/lib/date-utils";
import { requireUser } from "~/services/auth.server";
import { getDashboardData } from "~/services/dashboard.server";

export const meta: MetaFunction = () => {
	return [{ title: "Dashboard — GreenRoom" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await requireUser(request);
	const data = await getDashboardData(user.id);
	return { user, ...data };
}

export default function Dashboard() {
	const { user, groups, upcomingEvents, pendingRequests, pendingConfirmations } =
		useLoaderData<typeof loader>();
	const displayGroups = groups.slice(0, 4);
	const hasActions = pendingRequests.length > 0 || pendingConfirmations.length > 0;

	return (
		<div>
			<h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.name}! 👋</h1>
			<p className="mt-2 text-slate-600">Here&apos;s what&apos;s happening with your groups.</p>

			{/* Action Required */}
			{hasActions ? (
				<div className="mt-8">
					<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
						<AlertCircle className="h-5 w-5 text-amber-500" /> Action Required
					</h2>
					<div className="mt-3 space-y-3">
						{pendingRequests.map((req) => (
							<Link
								key={req.id}
								to={`/groups/${req.groupId}/availability/${req.id}`}
								className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 transition-all hover:border-amber-300 hover:shadow-sm"
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-sm">📋</span>
										<span className="truncate text-sm font-semibold text-slate-900">
											&ldquo;{req.title}&rdquo; needs your response
										</span>
									</div>
									<div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
										<span>{req.groupName}</span>
										<span>·</span>
										<span>{req.dateRange}</span>
										{req.expiresAt && (
											<>
												<span>·</span>
												<span className="flex items-center gap-1 text-amber-600">
													<Clock className="h-3 w-3" />
													Due {formatDateShort(req.expiresAt)}
												</span>
											</>
										)}
									</div>
								</div>
								<span className="ml-4 shrink-0 text-sm font-medium text-emerald-600">
									Respond →
								</span>
							</Link>
						))}
						{pendingConfirmations.map((evt) => (
							<Link
								key={evt.id}
								to={`/groups/${evt.groupId}/events/${evt.id}`}
								className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 transition-all hover:border-amber-300 hover:shadow-sm"
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-sm">
											{evt.eventType === "show"
												? "🎭"
												: evt.eventType === "rehearsal"
													? "🎯"
													: "📅"}
										</span>
										<span className="truncate text-sm font-semibold text-slate-900">
											Confirm attendance: &ldquo;{evt.title}&rdquo;
										</span>
									</div>
									<div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
										<span>{evt.groupName}</span>
										<span>·</span>
										<span>{formatDateShort(evt.startTime)}</span>
									</div>
								</div>
								<span className="ml-4 shrink-0 text-sm font-medium text-emerald-600">
									Confirm →
								</span>
							</Link>
						))}
					</div>
				</div>
			) : (
				<div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
					<div className="text-3xl">✅</div>
					<h3 className="mt-3 text-base font-semibold text-slate-900">
						You&apos;re all caught up!
					</h3>
					<p className="mt-1 text-sm text-slate-500">
						No pending availability requests or event confirmations.
					</p>
				</div>
			)}

			{/* Upcoming Events */}
			<div className="mt-8">
				<div className="flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
						<CalendarDays className="h-5 w-5" /> Upcoming Events
					</h2>
				</div>
				{upcomingEvents.length === 0 ? (
					<div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
						<p className="text-sm text-slate-500">
							No upcoming events. Events will appear here when they&apos;re scheduled.
						</p>
					</div>
				) : (
					<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{upcomingEvents.map((event) => (
							<EventCard
								key={event.id}
								id={event.id}
								groupId={event.groupId}
								title={event.title}
								eventType={event.eventType}
								startTime={event.startTime as unknown as string}
								endTime={event.endTime as unknown as string}
								location={event.location}
								groupName={event.groupName}
								userStatus={event.userStatus}
								compact
							/>
						))}
					</div>
				)}
			</div>

			{/* Your Groups */}
			<div className="mt-8">
				<div className="flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
						<Users className="h-5 w-5" /> Your Groups
					</h2>
					{groups.length > 0 && (
						<div className="flex items-center gap-3">
							<Link
								to="/groups/new"
								className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
							>
								<Plus className="h-4 w-4" /> Create Group
							</Link>
							<Link
								to="/groups/join"
								className="text-sm font-medium text-slate-500 hover:text-slate-700"
							>
								Join Group
							</Link>
						</div>
					)}
				</div>

				{groups.length === 0 ? (
					<div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
						<div className="text-3xl">🎭</div>
						<h3 className="mt-3 text-base font-semibold text-slate-900">Create your first group</h3>
						<p className="mt-1 max-w-sm text-sm text-slate-500">
							Get your ensemble together by creating a group or joining one with an invite code.
						</p>
						<div className="mt-4 flex gap-3">
							<Link
								to="/groups/new"
								className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
							>
								Create Group
							</Link>
							<Link
								to="/groups/join"
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
							>
								Join Group
							</Link>
						</div>
					</div>
				) : (
					<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{displayGroups.map((group) => (
							<Link
								key={group.id}
								to={`/groups/${group.id}`}
								className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
							>
								<h3 className="text-base font-semibold text-slate-900 group-hover:text-emerald-600">
									{group.name}
								</h3>
								<div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
									<span>
										{group.memberCount} {group.memberCount === 1 ? "member" : "members"}
									</span>
									<span>·</span>
									<span className="capitalize">{group.role}</span>
								</div>
							</Link>
						))}
						{groups.length > 4 && (
							<Link
								to="/groups"
								className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm font-medium text-slate-500 transition-all hover:border-emerald-200 hover:text-emerald-600"
							>
								View all {groups.length} groups →
							</Link>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
