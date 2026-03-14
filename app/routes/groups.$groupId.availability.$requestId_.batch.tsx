import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import { ArrowLeft, Calendar, Check, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import { InlineTimezoneSelector } from "~/components/timezone-selector";
import {
	formatDateDisplay,
	formatEventTime,
	formatTimeRange,
	getTimezoneAbbreviation,
} from "~/lib/date-utils";
import { getAvailabilityRequest } from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { sendBatchEventsFromAvailabilityNotification } from "~/services/email.server";
import {
	createEventsFromAvailability,
	getAvailabilityForEventDate,
} from "~/services/events.server";
import {
	getGroupMembersWithPreferences,
	getGroupWithMembers,
	requireGroupAdminOrPermission,
} from "~/services/groups.server";
import { sendBatchEventsCreatedWebhook } from "~/services/webhook.server";
import type { NotificationPreferences } from "../../src/db/schema.js";

export const DEFAULT_START_TIME = "19:00";
export const DEFAULT_END_TIME = "21:00";

export const meta: MetaFunction = () => {
	return [{ title: "Batch Create Events — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const requestId = params.requestId ?? "";
	const user = await requireGroupAdminOrPermission(request, groupId, "membersCanCreateEvents");

	const availRequest = await getAvailabilityRequest(requestId);
	if (!availRequest || availRequest.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	const url = new URL(request.url);
	const datesParam = url.searchParams.get("dates");
	if (!datesParam) {
		return redirect(`/groups/${groupId}/availability/${requestId}`);
	}
	const selectedDates = datesParam.split(",").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
	if (selectedDates.length === 0) {
		return redirect(`/groups/${groupId}/availability/${requestId}`);
	}

	return {
		availRequest,
		selectedDates,
		userTimezone: user.timezone,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const requestId = params.requestId ?? "";
	const user = await requireGroupAdminOrPermission(request, groupId, "membersCanCreateEvents");
	const formData = await request.formData();
	await validateCsrfToken(request, formData);

	const title = formData.get("title");
	const eventType = formData.get("eventType");
	const description = formData.get("description");
	const startTime = formData.get("startTime");
	const endTime = formData.get("endTime");
	const dates = formData.get("dates");
	const formTimezone = formData.get("timezone");
	const timezone =
		typeof formTimezone === "string" && formTimezone ? formTimezone : (user.timezone ?? undefined);

	// Validate availability request belongs to this group (IDOR prevention)
	const availRequest = await getAvailabilityRequest(requestId);
	if (!availRequest || availRequest.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	if (typeof title !== "string" || !title.trim()) {
		return { error: "Title is required." };
	}
	if (title.trim().length > 200) {
		return { error: "Title must be 200 characters or less." };
	}
	if (typeof eventType !== "string" || !["rehearsal", "show", "other"].includes(eventType)) {
		return { error: "Please select an event type." };
	}
	if (typeof description === "string" && description.trim().length > 2000) {
		return { error: "Description must be 2,000 characters or less." };
	}
	if (typeof startTime !== "string" || !startTime) {
		return { error: "Start time is required." };
	}
	if (typeof endTime !== "string" || !endTime) {
		return { error: "End time is required." };
	}
	if (startTime >= endTime) {
		return { error: "End time must be after start time." };
	}
	if (typeof dates !== "string" || !dates) {
		return { error: "No dates selected." };
	}

	const selectedDates = dates.split(",").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
	if (selectedDates.length === 0) {
		return { error: "No valid dates selected." };
	}

	// Parse per-date locations
	const datesWithLocations = selectedDates.map((date) => {
		const loc = formData.get(`location-${date}`);
		const locationStr =
			typeof loc === "string" && loc.trim().length <= 200 ? loc.trim() || undefined : undefined;
		return {
			date,
			startTime,
			endTime,
			location: locationStr,
		};
	});

	const events = await createEventsFromAvailability({
		groupId,
		requestId,
		dates: datesWithLocations,
		title: title.trim(),
		description: typeof description === "string" ? description.trim() || undefined : undefined,
		eventType: eventType as "rehearsal" | "show" | "other",
		createdById: user.id,
		timezone,
	});

	// Fire-and-forget notifications
	const appUrl = process.env.APP_URL ?? "http://localhost:5173";
	const eventsUrl = `${appUrl}/groups/${groupId}/events`;
	const preferencesUrl = `${appUrl}/groups/${groupId}/notifications`;

	void (async () => {
		const [groupData, membersWithPrefs] = await Promise.all([
			getGroupWithMembers(groupId),
			getGroupMembersWithPreferences(groupId),
		]);
		if (!groupData) return;

		const prefsMap = new Map(membersWithPrefs.map((m) => [m.id, m.notificationPreferences]));

		// Build per-member "best status" across all batch dates
		const memberBestStatus = new Map<string, "available" | "maybe" | "not_available">();
		const respondedUserIds = new Set<string>();

		for (const date of selectedDates) {
			const availData = await getAvailabilityForEventDate(requestId, date);
			for (const entry of availData) {
				respondedUserIds.add(entry.userId);
				const current = memberBestStatus.get(entry.userId);
				if (entry.status === "available") {
					memberBestStatus.set(entry.userId, "available");
				} else if (entry.status === "maybe" && current !== "available") {
					memberBestStatus.set(entry.userId, "maybe");
				} else if (!current) {
					memberBestStatus.set(entry.userId, entry.status as "not_available");
				}
			}
		}

		const memberMap = new Map(
			groupData.members.map((m) => [
				m.id,
				{
					email: m.email,
					name: m.name,
					timezone: m.timezone,
					notificationPreferences: prefsMap.get(m.id) as NotificationPreferences | undefined,
				},
			]),
		);

		const availableRecipients: Array<{
			email: string;
			name: string;
			timezone?: string | null;
			notificationPreferences?: NotificationPreferences;
		}> = [];
		const maybeRecipients: Array<{
			email: string;
			name: string;
			timezone?: string | null;
			notificationPreferences?: NotificationPreferences;
		}> = [];
		const noResponseRecipients: Array<{
			email: string;
			name: string;
			timezone?: string | null;
			notificationPreferences?: NotificationPreferences;
		}> = [];

		for (const member of groupData.members) {
			if (member.id === user.id) continue;
			const info = memberMap.get(member.id);
			if (!info) continue;

			const bestStatus = memberBestStatus.get(member.id);
			if (!respondedUserIds.has(member.id)) {
				noResponseRecipients.push(info);
			} else if (bestStatus === "available") {
				availableRecipients.push(info);
			} else if (bestStatus === "maybe") {
				maybeRecipients.push(info);
			} else if (bestStatus === "not_available") {
				// Explicitly said "not available" for all batch dates → no email
			} else {
				// Responded to the request but didn't mark these specific dates
				noResponseRecipients.push(info);
			}
		}

		const eventDetails = events.map((e) => ({
			title: e.title,
			eventType: e.eventType,
			startTime: e.startTime,
			endTime: e.endTime,
			location: e.location ?? undefined,
			eventUrl: `${appUrl}/groups/${groupId}/events/${e.id}`,
		}));

		void sendBatchEventsFromAvailabilityNotification({
			events: eventDetails,
			groupName: groupData.group.name,
			availableRecipients,
			maybeRecipients,
			noResponseRecipients,
			eventsUrl,
			preferencesUrl,
		});

		if (groupData.group.webhookUrl) {
			const tz = timezone ?? undefined;
			const webhookEvents = events.map((e) => {
				const dateTime = formatEventTime(e.startTime, e.endTime, tz);
				const tzAbbrev = getTimezoneAbbreviation(e.startTime, tz);
				return {
					dateTime: tzAbbrev ? `${dateTime} (${tzAbbrev})` : dateTime,
					location: e.location ?? undefined,
				};
			});
			sendBatchEventsCreatedWebhook(groupData.group.webhookUrl, {
				groupName: groupData.group.name,
				title: title.trim(),
				eventType,
				events: webhookEvents,
				eventsUrl,
			});
		}
	})();

	return redirect(
		`/groups/${groupId}/availability/${requestId}?batchSuccess=true&count=${events.length}`,
	);
}

const EVENT_TYPE_OPTIONS = [
	{ value: "rehearsal", label: "Rehearsal" },
	{ value: "show", label: "Show" },
	{ value: "other", label: "Other" },
] as const;

export default function BatchCreateEvents() {
	const { availRequest, selectedDates, userTimezone } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const [step, setStep] = useState<"configure" | "review">("configure");
	const [title, setTitle] = useState(availRequest.title);
	const [eventType, setEventType] = useState("rehearsal");
	const [description, setDescription] = useState("");
	const [startTime, setStartTime] = useState(availRequest.requestedStartTime ?? DEFAULT_START_TIME);
	const [endTime, setEndTime] = useState(availRequest.requestedEndTime ?? DEFAULT_END_TIME);
	const [timezone, setTimezone] = useState<string | null>(userTimezone ?? null);
	const [locations, setLocations] = useState<Record<string, string>>({});
	const [applyAllLocation, setApplyAllLocation] = useState("");
	const [showDescription, setShowDescription] = useState(false);
	const [showLocations, setShowLocations] = useState(false);

	const canReview = title.trim() !== "" && startTime !== "" && endTime !== "" && eventType !== "";

	function handleApplyAll() {
		const updated: Record<string, string> = {};
		for (const date of selectedDates) {
			updated[date] = applyAllLocation;
		}
		setLocations(updated);
	}

	function handleLocationChange(date: string, value: string) {
		setLocations((prev) => ({ ...prev, [date]: value }));
	}

	const typeBadgeClasses: Record<string, string> = {
		rehearsal: "bg-emerald-100 text-emerald-700",
		show: "bg-purple-100 text-purple-700",
		other: "bg-slate-100 text-slate-700",
	};

	return (
		<div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
			{/* Back link */}
			<Link
				to={`/groups/${availRequest.groupId}/availability/${availRequest.id}`}
				className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to availability request
			</Link>

			{/* Step indicator */}
			<div className="flex items-center justify-center gap-2">
				<div
					className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
						step === "configure" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"
					}`}
				>
					{step === "review" ? <Check className="h-3.5 w-3.5" /> : "1"}
				</div>
				<div className="h-px w-8 bg-slate-300" />
				<div
					className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
						step === "review" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
					}`}
				>
					2
				</div>
			</div>

			{/* Page title */}
			<h1 className="text-center text-xl font-bold text-slate-900">
				Create {selectedDates.length} Event
				{selectedDates.length !== 1 ? "s" : ""}
			</h1>

			{actionData && "error" in actionData && (
				<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			{step === "configure" ? (
				<ConfigureStep
					title={title}
					onTitleChange={setTitle}
					eventType={eventType}
					onEventTypeChange={setEventType}
					description={description}
					onDescriptionChange={setDescription}
					startTime={startTime}
					onStartTimeChange={setStartTime}
					endTime={endTime}
					onEndTimeChange={setEndTime}
					timezone={timezone}
					onTimezoneChange={setTimezone}
					selectedDates={selectedDates}
					locations={locations}
					onLocationChange={handleLocationChange}
					applyAllLocation={applyAllLocation}
					onApplyAllLocationChange={setApplyAllLocation}
					onApplyAll={handleApplyAll}
					canReview={canReview}
					onNext={() => setStep("review")}
					typeBadgeClasses={typeBadgeClasses}
					showDescription={showDescription}
					onToggleDescription={(show: boolean) => {
						setShowDescription(show);
						if (!show) setDescription("");
					}}
					showLocations={showLocations}
					onToggleLocations={(show: boolean) => {
						setShowLocations(show);
						if (!show) {
							setLocations({});
							setApplyAllLocation("");
						}
					}}
				/>
			) : (
				<ReviewStep
					title={title}
					eventType={eventType}
					description={description}
					startTime={startTime}
					endTime={endTime}
					timezone={timezone}
					selectedDates={selectedDates}
					locations={locations}
					isSubmitting={isSubmitting}
					onBack={() => setStep("configure")}
					typeBadgeClasses={typeBadgeClasses}
				/>
			)}
		</div>
	);
}

function ConfigureStep({
	title,
	onTitleChange,
	eventType,
	onEventTypeChange,
	description,
	onDescriptionChange,
	startTime,
	onStartTimeChange,
	endTime,
	onEndTimeChange,
	timezone,
	onTimezoneChange,
	selectedDates,
	locations,
	onLocationChange,
	applyAllLocation,
	onApplyAllLocationChange,
	onApplyAll,
	canReview,
	onNext,
	typeBadgeClasses,
	showDescription,
	onToggleDescription,
	showLocations,
	onToggleLocations,
}: {
	title: string;
	onTitleChange: (v: string) => void;
	eventType: string;
	onEventTypeChange: (v: string) => void;
	description: string;
	onDescriptionChange: (v: string) => void;
	startTime: string;
	onStartTimeChange: (v: string) => void;
	endTime: string;
	onEndTimeChange: (v: string) => void;
	timezone: string | null;
	onTimezoneChange: (v: string) => void;
	selectedDates: string[];
	locations: Record<string, string>;
	onLocationChange: (date: string, value: string) => void;
	applyAllLocation: string;
	onApplyAllLocationChange: (v: string) => void;
	onApplyAll: () => void;
	canReview: boolean;
	onNext: () => void;
	typeBadgeClasses: Record<string, string>;
	showDescription: boolean;
	onToggleDescription: (show: boolean) => void;
	showLocations: boolean;
	onToggleLocations: (show: boolean) => void;
}) {
	return (
		<div className="space-y-6">
			{/* Event Details Card */}
			<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Event Details</h2>
				<p className="mt-1 text-sm text-slate-500">
					These settings apply to all {selectedDates.length} events.
				</p>

				<div className="mt-5 space-y-4">
					{/* Title */}
					<div>
						<label htmlFor="title" className="block text-sm font-medium text-slate-700">
							Title <span className="text-red-500">*</span>
						</label>
						<input
							id="title"
							type="text"
							value={title}
							onChange={(e) => onTitleChange(e.target.value)}
							maxLength={200}
							className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							placeholder="e.g. Weekly Rehearsal"
						/>
					</div>

					{/* Event Type */}
					<div>
						{/* biome-ignore lint/a11y/noLabelWithoutControl: radio group */}
						<label className="block text-sm font-medium text-slate-700">Event Type</label>
						<div className="mt-2 flex gap-3">
							{EVENT_TYPE_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => onEventTypeChange(opt.value)}
									className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
										eventType === opt.value
											? typeBadgeClasses[opt.value]
											: "bg-slate-50 text-slate-600 hover:bg-slate-100"
									}`}
								>
									{opt.label}
								</button>
							))}
						</div>
					</div>

					{/* Description (optional — toggle) */}
					{!showDescription ? (
						<button
							type="button"
							onClick={() => onToggleDescription(true)}
							className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
						>
							<Plus className="h-3.5 w-3.5" />
							Add description
						</button>
					) : (
						<div>
							<div className="flex items-center justify-between">
								<label htmlFor="description" className="block text-sm font-medium text-slate-700">
									Description
								</label>
								<button
									type="button"
									onClick={() => onToggleDescription(false)}
									className="text-xs text-slate-400 hover:text-slate-600"
								>
									Remove
								</button>
							</div>
							<textarea
								id="description"
								value={description}
								onChange={(e) => onDescriptionChange(e.target.value)}
								maxLength={2000}
								rows={3}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="Add any notes or details..."
							/>
						</div>
					)}

					{/* Time Inputs */}
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label htmlFor="startTime" className="block text-sm font-medium text-slate-700">
								Start Time <span className="text-red-500">*</span>
							</label>
							<input
								id="startTime"
								type="time"
								value={startTime}
								onChange={(e) => onStartTimeChange(e.target.value)}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="endTime" className="block text-sm font-medium text-slate-700">
								End Time <span className="text-red-500">*</span>
							</label>
							<input
								id="endTime"
								type="time"
								value={endTime}
								onChange={(e) => onEndTimeChange(e.target.value)}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>

					{/* Timezone */}
					<div>
						{/* biome-ignore lint/a11y/noLabelWithoutControl: custom component */}
						<label className="block text-sm font-medium text-slate-700">Timezone</label>
						<div className="mt-1">
							<InlineTimezoneSelector timezone={timezone} onChange={onTimezoneChange} />
						</div>
					</div>
				</div>
			</div>

			{/* Per-Date Locations (optional — toggle) */}
			{!showLocations ? (
				<button
					type="button"
					onClick={() => onToggleLocations(true)}
					className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
				>
					<MapPin className="h-4 w-4" />
					Add locations per date
				</button>
			) : (
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-semibold text-slate-900">
							<MapPin className="mr-1.5 inline-block h-5 w-5 text-slate-400" />
							Locations
						</h2>
						<button
							type="button"
							onClick={() => onToggleLocations(false)}
							className="text-xs text-slate-400 hover:text-slate-600"
						>
							Remove
						</button>
					</div>
					<p className="mt-1 text-sm text-slate-500">Set a location for each event date.</p>

					{/* Apply to All */}
					<div className="mt-4 flex gap-2">
						<input
							type="text"
							value={applyAllLocation}
							onChange={(e) => onApplyAllLocationChange(e.target.value)}
							maxLength={200}
							className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							placeholder="Same location for all dates"
						/>
						<button
							type="button"
							onClick={onApplyAll}
							className="whitespace-nowrap rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
						>
							Apply to All
						</button>
					</div>

					{/* Per-date inputs */}
					<div className="mt-4 space-y-3">
						{selectedDates.map((date) => {
							const { dayOfWeek, display } = formatDateDisplay(date);
							return (
								<div key={date} className="flex items-center gap-3">
									<div className="w-28 shrink-0">
										<span className="text-sm font-medium text-slate-700">{dayOfWeek}</span>
										<span className="ml-1 text-sm text-slate-500">{display}</span>
									</div>
									<input
										type="text"
										value={locations[date] ?? ""}
										onChange={(e) => onLocationChange(date, e.target.value)}
										maxLength={200}
										className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
										placeholder="Location"
									/>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Next Button */}
			<div className="flex justify-end">
				<button
					type="button"
					onClick={onNext}
					disabled={!canReview}
					className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Review Events →
				</button>
			</div>
		</div>
	);
}

function ReviewStep({
	title,
	eventType,
	description,
	startTime,
	endTime,
	timezone,
	selectedDates,
	locations,
	isSubmitting,
	onBack,
	typeBadgeClasses,
}: {
	title: string;
	eventType: string;
	description: string;
	startTime: string;
	endTime: string;
	timezone: string | null;
	selectedDates: string[];
	locations: Record<string, string>;
	isSubmitting: boolean;
	onBack: () => void;
	typeBadgeClasses: Record<string, string>;
}) {
	const typeLabel = EVENT_TYPE_OPTIONS.find((o) => o.value === eventType)?.label ?? eventType;
	const timeDisplay = formatTimeRange(startTime, endTime);

	return (
		<div className="space-y-6">
			{/* Summary Banner */}
			<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
				<div className="flex items-center gap-2">
					<Calendar className="h-5 w-5 text-emerald-600" />
					<span className="text-sm font-semibold text-emerald-800">
						Ready to Create — {selectedDates.length} event
						{selectedDates.length !== 1 ? "s" : ""}
					</span>
				</div>
			</div>

			{/* Event Cards */}
			<div className="space-y-3">
				{selectedDates.map((date, index) => {
					const { dayOfWeek, display } = formatDateDisplay(date, timezone ?? undefined);
					const location = locations[date];
					return (
						<div key={date} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
							<div className="flex items-start gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
									{index + 1}
								</span>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium text-slate-900">{title}</span>
										<span
											className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClasses[eventType]}`}
										>
											{typeLabel}
										</span>
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
										<span>
											{dayOfWeek} {display}
										</span>
										<span>·</span>
										<span>{timeDisplay}</span>
									</div>
									{location && (
										<div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
											<MapPin className="h-3.5 w-3.5" />
											{location}
										</div>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Action Buttons */}
			<Form method="post">
				<CsrfInput />
				<input type="hidden" name="title" value={title} />
				<input type="hidden" name="eventType" value={eventType} />
				{description && <input type="hidden" name="description" value={description} />}
				<input type="hidden" name="startTime" value={startTime} />
				<input type="hidden" name="endTime" value={endTime} />
				<input type="hidden" name="timezone" value={timezone ?? ""} />
				<input type="hidden" name="dates" value={selectedDates.join(",")} />
				{selectedDates.map((date) =>
					locations[date] ? (
						<input key={date} type="hidden" name={`location-${date}`} value={locations[date]} />
					) : null,
				)}

				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={onBack}
						className="text-sm text-slate-500 hover:text-slate-700"
					>
						← Back to Configuration
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting
							? "Creating..."
							: `Create ${selectedDates.length} Event${selectedDates.length !== 1 ? "s" : ""}`}
					</button>
				</div>
			</Form>
		</div>
	);
}
