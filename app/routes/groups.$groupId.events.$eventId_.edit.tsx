import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
	useParams,
} from "@remix-run/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import { DangerZone } from "~/components/danger-zone";
import { EventDateTimeInputs } from "~/components/event-date-time-inputs";
import { EventTypeSelector } from "~/components/event-type-selector";
import {
	formatEventTime,
	formatTime,
	getTimezoneAbbreviation,
	localTimeToUTC,
	utcToLocalParts,
} from "~/lib/date-utils";
import { detectEventChanges, formatEventChangeSummary, hasAnyChanges } from "~/lib/edit-utils";
import { validateCsrfToken } from "~/services/csrf.server";
import {
	sendEventEditedNotification,
	sendEventReconfirmationNotification,
} from "~/services/email.server";
import {
	deleteEvent,
	getEventWithAssignments,
	resetEventConfirmations,
	updateEvent,
} from "~/services/events.server";
import {
	getGroupById,
	getGroupMembersWithPreferences,
	isGroupAdmin,
	requireGroupMember,
} from "~/services/groups.server";
import { sendEventEditedWebhook } from "~/services/webhook.server";

export const meta: MetaFunction = () => {
	return [{ title: "Edit Event — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const eventId = params.eventId ?? "";
	const user = await requireGroupMember(request, groupId);
	const admin = await isGroupAdmin(user.id, groupId);

	const data = await getEventWithAssignments(eventId);
	if (!data || data.event.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	// Only admin or creator can edit
	if (!admin && data.event.createdById !== user.id) {
		throw new Response("Forbidden", { status: 403 });
	}

	const eventTimezone = data.event.timezone ?? user.timezone;
	const startParts = utcToLocalParts(new Date(data.event.startTime), eventTimezone);
	const endParts = utcToLocalParts(new Date(data.event.endTime), eventTimezone);
	const ctParts = data.event.callTime
		? utcToLocalParts(new Date(data.event.callTime), eventTimezone)
		: null;

	return {
		event: data.event,
		eventTimezone,
		hasAssignments: data.assignments.length > 0,
		prefill: {
			date: startParts.date,
			startTime: startParts.time,
			endTime: endParts.time,
			callTime: ctParts?.time ?? "",
		},
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const eventId = params.eventId ?? "";
	const user = await requireGroupMember(request, groupId);
	const admin = await isGroupAdmin(user.id, groupId);

	// Verify the event belongs to this group before any mutation
	const data = await getEventWithAssignments(eventId);
	if (!data || data.event.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	// Only admin or creator can edit
	if (!admin && data.event.createdById !== user.id) {
		throw new Response("Forbidden", { status: 403 });
	}

	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	if (intent === "delete") {
		await deleteEvent(eventId);
		return redirect(`/groups/${groupId}/events`);
	}

	const title = formData.get("title");
	const eventType = formData.get("eventType");
	const date = formData.get("date");
	const startTime = formData.get("startTime");
	const endTime = formData.get("endTime");
	const location = formData.get("location");
	const description = formData.get("description");
	const callTime = formData.get("callTime");
	const formTimezone = formData.get("timezone");
	const timezone =
		typeof formTimezone === "string" && formTimezone ? formTimezone : (user.timezone ?? undefined);
	const notifyMembers = formData.get("notifyMembers") === "on";
	const requestReconfirmation = formData.get("requestReconfirmation") === "on";

	if (typeof title !== "string" || !title.trim()) {
		return { error: "Title is required." };
	}
	if (title.trim().length > 200) {
		return { error: "Title must be 200 characters or less." };
	}
	if (typeof eventType !== "string" || !["rehearsal", "show", "other"].includes(eventType)) {
		return { error: "Please select an event type." };
	}
	if (typeof date !== "string" || !date) {
		return { error: "Date is required." };
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

	const hasCallTime =
		eventType === "show" && typeof callTime === "string" && callTime.trim() !== "";
	if (hasCallTime && callTime.trim() >= startTime) {
		return { error: "Call time must be before start time." };
	}

	if (typeof location === "string" && location.trim().length > 200) {
		return { error: "Location must be 200 characters or less." };
	}
	if (typeof description === "string" && description.trim().length > 2000) {
		return { error: "Description must be 2,000 characters or less." };
	}

	// Build new event snapshot for change detection
	const newStartTime = localTimeToUTC(date, startTime, timezone);
	const newEndTime = localTimeToUTC(date, endTime, timezone);
	const newCallTime = hasCallTime ? localTimeToUTC(date, callTime.trim(), timezone) : null;

	const oldEvent = data.event;
	const changes = detectEventChanges(
		{
			title: oldEvent.title,
			eventType: oldEvent.eventType,
			startTime: new Date(oldEvent.startTime),
			endTime: new Date(oldEvent.endTime),
			location: oldEvent.location,
			description: oldEvent.description,
			callTime: oldEvent.callTime ? new Date(oldEvent.callTime) : null,
		},
		{
			title: title.trim(),
			eventType,
			startTime: newStartTime,
			endTime: newEndTime,
			location: typeof location === "string" ? location.trim() || null : null,
			description: typeof description === "string" ? description.trim() || null : null,
			callTime: newCallTime,
		},
	);

	// If nothing changed, just redirect back
	if (!hasAnyChanges(changes)) {
		return redirect(`/groups/${groupId}/events/${eventId}`);
	}

	await updateEvent(eventId, {
		title: title.trim(),
		description: typeof description === "string" ? description : undefined,
		eventType,
		startTime: newStartTime,
		endTime: newEndTime,
		location: typeof location === "string" ? location : undefined,
		callTime: newCallTime,
		timezone,
	});

	// Handle re-confirmation: reset confirmed attendees to pending
	if (requestReconfirmation && data.assignments.length > 0) {
		await resetEventConfirmations(eventId);
	}

	// Fire-and-forget notifications
	if (notifyMembers && hasAnyChanges(changes)) {
		const changeSummary = formatEventChangeSummary(changes, timezone);
		const appUrl = process.env.APP_URL ?? "http://localhost:5173";
		const preferencesUrl = `${appUrl}/groups/${groupId}/notifications`;
		const eventUrl = `${appUrl}/groups/${groupId}/events/${eventId}`;

		void Promise.all([getGroupById(groupId), getGroupMembersWithPreferences(groupId)]).then(
			([group, members]) => {
				if (!group) return;
				const recipients = members
					.filter((m) => m.id !== user.id)
					.map((m) => ({
						email: m.email,
						name: m.name,
						timezone: m.timezone,
						notificationPreferences: m.notificationPreferences,
					}));
				if (recipients.length === 0) return;

				if (requestReconfirmation && data.assignments.length > 0) {
					// Send re-confirmation email to assignees (excluding editor)
					const assigneeIds = new Set(data.assignments.map((a) => a.userId));
					const assigneeRecipients = recipients.filter((r) => {
						const member = members.find((m) => m.email === r.email);
						return member && assigneeIds.has(member.id);
					});
					if (assigneeRecipients.length > 0) {
						void sendEventReconfirmationNotification({
							eventTitle: title.trim(),
							eventType,
							startTime: newStartTime,
							endTime: newEndTime,
							location: typeof location === "string" ? location.trim() || undefined : undefined,
							groupName: group.name,
							changes: changeSummary,
							recipients: assigneeRecipients,
							eventUrl,
							preferencesUrl,
						});
					}
					// Send regular edit notification to non-assignees
					const nonAssigneeRecipients = recipients.filter((r) => {
						const member = members.find((m) => m.email === r.email);
						return member && !assigneeIds.has(member.id);
					});
					if (nonAssigneeRecipients.length > 0) {
						void sendEventEditedNotification({
							eventTitle: title.trim(),
							eventType,
							startTime: newStartTime,
							endTime: newEndTime,
							location: typeof location === "string" ? location.trim() || undefined : undefined,
							groupName: group.name,
							changes: changeSummary,
							recipients: nonAssigneeRecipients,
							eventUrl,
							preferencesUrl,
						});
					}
				} else {
					void sendEventEditedNotification({
						eventTitle: title.trim(),
						eventType,
						startTime: newStartTime,
						endTime: newEndTime,
						location: typeof location === "string" ? location.trim() || undefined : undefined,
						groupName: group.name,
						changes: changeSummary,
						recipients,
						eventUrl,
						preferencesUrl,
					});
				}

				// Discord webhook
				if (group.webhookUrl) {
					const tz = timezone ?? oldEvent.timezone;
					const dateTime = formatEventTime(newStartTime, newEndTime, tz);
					const tzAbbr = getTimezoneAbbreviation(newStartTime, tz);
					const webhookCallTime = newCallTime ? formatTime(newCallTime, tz) : null;
					sendEventEditedWebhook(group.webhookUrl, {
						groupName: group.name,
						eventTitle: title.trim(),
						eventType,
						dateTime: tzAbbr ? `${dateTime} (${tzAbbr})` : dateTime,
						location: typeof location === "string" ? location.trim() || undefined : undefined,
						callTime: webhookCallTime
							? tzAbbr
								? `${webhookCallTime} (${tzAbbr})`
								: webhookCallTime
							: undefined,
						changes: changeSummary,
						eventUrl,
					});
				}
			},
		);
	}

	return redirect(`/groups/${groupId}/events/${eventId}`);
}

export default function EditEvent() {
	const { groupId } = useParams();
	const { event, prefill, hasAssignments } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const [eventType, setEventType] = useState(event.eventType);
	const [timezone, setTimezone] = useState(() => event.timezone ?? "America/Los_Angeles");
	const isShow = eventType === "show";

	return (
		<div className="max-w-3xl">
			<div className="mb-6">
				<Link
					to={`/groups/${groupId}/events/${event.id}`}
					className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Event
				</Link>
				<h2 className="mt-2 text-2xl font-bold text-slate-900">Edit Event</h2>
			</div>

			{actionData && "error" in actionData && (
				<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			<Form method="post" className="space-y-6">
				<CsrfInput />
				{/* Title */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="space-y-4">
						<div>
							<label htmlFor="title" className="block text-sm font-medium text-slate-700">
								Title <span className="text-red-500">*</span>
							</label>
							<input
								id="title"
								name="title"
								type="text"
								required
								maxLength={200}
								defaultValue={event.title}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<span className="block text-sm font-medium text-slate-700">
								Event Type <span className="text-red-500">*</span>
							</span>
							<EventTypeSelector
								defaultValue={event.eventType}
								onChange={(value) => setEventType(value as "rehearsal" | "show" | "other")}
							/>
						</div>
					</div>
				</div>

				{/* Date & Time */}
				<EventDateTimeInputs
					defaultDate={prefill.date}
					defaultStartTime={prefill.startTime}
					defaultEndTime={prefill.endTime}
					defaultCallTime={prefill.callTime}
					timezone={timezone}
					onTimezoneChange={setTimezone}
					isShow={isShow}
				/>

				{/* Location & Description */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="space-y-4">
						<div>
							<label htmlFor="location" className="block text-sm font-medium text-slate-700">
								Location
							</label>
							<input
								id="location"
								name="location"
								type="text"
								maxLength={200}
								defaultValue={event.location ?? ""}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="description" className="block text-sm font-medium text-slate-700">
								Description
							</label>
							<textarea
								id="description"
								name="description"
								rows={3}
								maxLength={2000}
								defaultValue={event.description ?? ""}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
				</div>

				{/* Notification Options */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="mb-3 text-sm font-semibold text-slate-900">Notification Options</h3>
					<div className="space-y-3">
						<label className="flex cursor-pointer items-start gap-3">
							<input
								type="checkbox"
								name="notifyMembers"
								defaultChecked
								className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
							/>
							<div>
								<span className="text-sm font-medium text-slate-700">
									Notify members of this change
								</span>
								<p className="text-xs text-slate-500">
									Sends an email to group members and posts to Discord (if configured)
								</p>
							</div>
						</label>
						{hasAssignments && (
							<label className="flex cursor-pointer items-start gap-3">
								<input
									type="checkbox"
									name="requestReconfirmation"
									className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
								/>
								<div>
									<span className="text-sm font-medium text-slate-700">
										Request re-confirmation from attendees
									</span>
									<p className="text-xs text-slate-500">
										Resets all attendee confirmations and asks them to confirm again
									</p>
								</div>
							</label>
						)}
					</div>
				</div>

				{/* Submit */}
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? "Saving..." : "Save Changes"}
					</button>
					<Link
						to={`/groups/${groupId}/events/${event.id}`}
						className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						Cancel
					</Link>
				</div>
			</Form>

			{/* Danger Zone */}
			<div className="mt-8">
				<DangerZone description="Deleting this event will remove all assignments and cannot be undone.">
					<Form method="post">
						<CsrfInput />
						<input type="hidden" name="intent" value="delete" />
						<button
							type="submit"
							onClick={(e) => {
								if (!confirm("Are you sure you want to delete this event?")) {
									e.preventDefault();
								}
							}}
							className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
						>
							<Trash2 className="h-4 w-4" /> Delete Event
						</button>
					</Form>
				</DangerZone>
			</div>
		</div>
	);
}
