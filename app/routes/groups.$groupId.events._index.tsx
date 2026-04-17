import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
	Link,
	useFetcher,
	useLoaderData,
	useRouteLoaderData,
	useSearchParams,
} from "@remix-run/react";
import { CalendarDays, Check, Clock, List, Plus } from "lucide-react";
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import { EmptyState } from "~/components/empty-state";
import { EventCalendar } from "~/components/event-calendar";
import { EventCard } from "~/components/event-card";
import { formatDateLong } from "~/lib/date-utils";
import { getAvailabilityRequest } from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { confirmAllPendingEventsInGroup, getGroupEvents } from "~/services/events.server";
import { requireGroupMember } from "~/services/groups.server";
import type { loader as groupLayoutLoader } from "./groups.$groupId";

export const meta: MetaFunction = () => {
	return [{ title: "Events — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupMember(request, groupId);
	const allEvents = await getGroupEvents(groupId, { userId: user.id });

	// Find pending upcoming events for the banner
	const now = new Date();
	const pendingUpcoming = allEvents.filter(
		(e) => e.userStatus === "pending" && new Date(e.startTime) >= now,
	);

	let pendingRequestTitle: string | null = null;
	if (pendingUpcoming.length > 0) {
		const requestIds = [
			...new Set(pendingUpcoming.map((e) => e.createdFromRequestId).filter(Boolean)),
		];
		if (requestIds.length === 1 && requestIds[0]) {
			const req = await getAvailabilityRequest(requestIds[0]);
			pendingRequestTitle = req?.title ?? null;
		}
	}

	return {
		events: allEvents,
		userId: user.id,
		pendingCount: pendingUpcoming.length,
		pendingRequestTitle,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupMember(request, groupId);
	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	if (intent === "confirm-all") {
		const result = await confirmAllPendingEventsInGroup(groupId, user.id);
		return { success: true, confirmedCount: result.confirmedCount };
	}

	return { success: false };
}

export default function Events() {
	const { events, pendingCount, pendingRequestTitle } = useLoaderData<typeof loader>();
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const role = parentData?.role;
	const groupId = parentData?.group?.id ?? "";
	const timezone = parentData?.user?.timezone ?? undefined;
	const canCreateEvents = role === "admin" || parentData?.group?.membersCanCreateEvents === true;
	const [searchParams] = useSearchParams();
	const confirmAllFetcher = useFetcher();

	const [view, setView] = useState<"list" | "calendar">(
		(searchParams.get("view") as "list" | "calendar") || "list",
	);
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [showPast, setShowPast] = useState(false);
	const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);

	const now = new Date();
	const filtered = typeFilter === "all" ? events : events.filter((e) => e.eventType === typeFilter);
	const upcoming = filtered.filter((e) => new Date(e.startTime) >= now);
	const past = filtered.filter((e) => new Date(e.startTime) < now).reverse();

	// Optimistic: hide banner after confirm-all is submitted
	const isConfirmingAll = confirmAllFetcher.state !== "idle";
	const showBanner = pendingCount > 0 && !isConfirmingAll;

	const calendarDateEvents =
		calendarSelectedDate && events.length > 0
			? events.filter((e) => {
					const d = new Date(e.startTime);
					const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
					return key === calendarSelectedDate;
				})
			: [];

	return (
		<div>
			{/* Header */}
			<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
				<h2 className="text-xl font-bold text-slate-900">Events</h2>
				<div className="flex items-center gap-3">
					{/* View Toggle */}
					<div className="flex rounded-lg border border-slate-200 bg-white">
						<button
							type="button"
							onClick={() => {
								setView("list");
								setCalendarSelectedDate(null);
							}}
							className={`inline-flex items-center gap-1.5 rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
								view === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
							}`}
						>
							<List className="h-3.5 w-3.5" /> List
						</button>
						<button
							type="button"
							onClick={() => setView("calendar")}
							className={`inline-flex items-center gap-1.5 rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
								view === "calendar" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
							}`}
						>
							<CalendarDays className="h-3.5 w-3.5" /> Calendar
						</button>
					</div>

					{/* Type Filter */}
					<select
						value={typeFilter}
						onChange={(e) => setTypeFilter(e.target.value)}
						className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
					>
						<option value="all">All Types</option>
						<option value="show">🎭 Shows</option>
						<option value="rehearsal">🎯 Rehearsals</option>
						<option value="other">📅 Other</option>
					</select>

					{canCreateEvents && (
						<Link
							to={`/groups/${groupId}/events/new`}
							className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
						>
							<Plus className="h-4 w-4" /> Create Event
						</Link>
					)}
				</div>
			</div>

			{/* Confirm All Banner */}
			{showBanner && (
				<div className="mb-6 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
								<Clock className="h-4 w-4 text-amber-600" />
							</div>
							<div>
								<p className="text-sm font-semibold text-slate-700">
									{pendingCount} event{pendingCount !== 1 ? "s" : ""} pending your confirmation
								</p>
								{pendingRequestTitle && (
									<p className="text-xs text-slate-500">
										Created from &ldquo;{pendingRequestTitle}&rdquo; request
									</p>
								)}
							</div>
						</div>
						<confirmAllFetcher.Form method="post">
							<CsrfInput />
							<input type="hidden" name="intent" value="confirm-all" />
							<button
								type="submit"
								className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
							>
								<Check className="h-4 w-4" /> Confirm All {pendingCount}
							</button>
						</confirmAllFetcher.Form>
					</div>
				</div>
			)}

			{/* List View */}
			{view === "list" && (
				<div className="space-y-6">
					{upcoming.length === 0 && past.length === 0 ? (
						<EmptyState
							icon={<CalendarDays className="h-10 w-10 text-slate-300" />}
							title="No events yet"
							description={
								canCreateEvents
									? "Create your first event or use availability results to schedule one."
									: "Events created by admins will appear here."
							}
							actions={
								canCreateEvents ? (
									<Link
										to={`/groups/${groupId}/events/new`}
										className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
									>
										<Plus className="h-4 w-4" /> Create Event
									</Link>
								) : undefined
							}
						/>
					) : (
						<>
							{/* Upcoming */}
							{upcoming.length > 0 && (
								<div>
									<h3 className="mb-3 text-sm font-semibold text-slate-700">
										Upcoming ({upcoming.length})
									</h3>
									<div className="grid gap-3 sm:grid-cols-2">
										{upcoming.map((event) => (
											<EventCard
												key={event.id}
												id={event.id}
												groupId={groupId}
												title={event.title}
												eventType={event.eventType}
												startTime={event.startTime as unknown as string}
												endTime={event.endTime as unknown as string}
												location={event.location}
												assignmentCount={event.assignmentCount}
												confirmedCount={event.confirmedCount}
												userStatus={
													isConfirmingAll && event.userStatus === "pending"
														? "confirmed"
														: event.userStatus
												}
												timezone={timezone}
												showActions
											/>
										))}
									</div>
								</div>
							)}

							{/* Past */}
							{past.length > 0 && (
								<div>
									<button
										type="button"
										onClick={() => setShowPast(!showPast)}
										className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-700"
									>
										Past Events ({past.length}) {showPast ? "▾" : "▸"}
									</button>
									{showPast && (
										<div className="grid gap-3 opacity-75 sm:grid-cols-2">
											{past.map((event) => (
												<EventCard
													key={event.id}
													id={event.id}
													groupId={groupId}
													title={event.title}
													eventType={event.eventType}
													startTime={event.startTime as unknown as string}
													endTime={event.endTime as unknown as string}
													location={event.location}
													assignmentCount={event.assignmentCount}
													confirmedCount={event.confirmedCount}
													userStatus={event.userStatus}
													timezone={timezone}
												/>
											))}
										</div>
									)}
								</div>
							)}
						</>
					)}
				</div>
			)}

			{/* Calendar View */}
			{view === "calendar" && (
				<div className="grid gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<EventCalendar
							events={events.map((e) => ({
								id: e.id,
								title: e.title,
								eventType: e.eventType,
								startTime: e.startTime as unknown as string,
							}))}
							onDateClick={(date) => setCalendarSelectedDate(date)}
						/>
					</div>
					<div>
						{calendarSelectedDate ? (
							<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
								<h3 className="mb-3 text-sm font-semibold text-slate-900">
									{formatDateLong(`${calendarSelectedDate}T12:00:00Z`, timezone)}
								</h3>
								{calendarDateEvents.length > 0 ? (
									<div className="space-y-3">
										{calendarDateEvents.map((event) => (
											<EventCard
												key={event.id}
												id={event.id}
												groupId={groupId}
												title={event.title}
												eventType={event.eventType}
												startTime={event.startTime as unknown as string}
												endTime={event.endTime as unknown as string}
												location={event.location}
												timezone={timezone}
												compact
											/>
										))}
									</div>
								) : (
									<p className="text-sm text-slate-500">No events on this day</p>
								)}
							</div>
						) : (
							<EmptyState description="Click a date with events to see details" />
						)}
					</div>
				</div>
			)}
		</div>
	);
}
