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
import { ArrowLeft, Users } from "lucide-react";
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import { EventDateTimeInputs } from "~/components/event-date-time-inputs";
import { EventTypeSelector } from "~/components/event-type-selector";
import { UserChipSelector } from "~/components/user-chip-selector";
import {
	formatEventTime,
	formatTime,
	getTimezoneAbbreviation,
	localTimeToUTC,
} from "~/lib/date-utils";
import { getAvailabilityRequest } from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import {
	sendEventCreatedNotification,
	sendEventFromAvailabilityNotification,
} from "~/services/email.server";
import {
	autoAssignFromAvailability,
	bulkAssignToEvent,
	createEvent,
	getAvailabilityForEventDate,
	getAvailabilityRequestGroupId,
} from "~/services/events.server";
import {
	getGroupMembersWithPreferences,
	getGroupWithMembers,
	requireGroupAdminOrPermission,
} from "~/services/groups.server";
import { sendEventCreatedWebhook } from "~/services/webhook.server";
import type { NotificationPreferences } from "../../src/db/schema.js";

export const meta: MetaFunction = () => {
	return [{ title: "Create Event — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupAdminOrPermission(request, groupId, "membersCanCreateEvents");

	const url = new URL(request.url);
	const fromRequestId = url.searchParams.get("fromRequest");
	const prefillDate = url.searchParams.get("date");

	let fromRequest: { id: string; title: string } | null = null;
	let availabilityData: Array<{ userId: string; userName: string; status: string }> = [];
	if (fromRequestId) {
		const req = await getAvailabilityRequest(fromRequestId);
		if (req && req.groupId === groupId) {
			fromRequest = { id: req.id, title: req.title };
			if (prefillDate) {
				availabilityData = await getAvailabilityForEventDate(fromRequestId, prefillDate);
			}
		}
	}

	const groupData = await getGroupWithMembers(groupId);
	const members = groupData?.members ?? [];

	return { fromRequest, prefillDate, members, availabilityData, userTimezone: user.timezone };
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupAdminOrPermission(request, groupId, "membersCanCreateEvents");
	const formData = await request.formData();
	await validateCsrfToken(request, formData);

	const title = formData.get("title");
	const eventType = formData.get("eventType");
	const date = formData.get("date");
	const startTime = formData.get("startTime");
	const endTime = formData.get("endTime");
	const location = formData.get("location");
	const description = formData.get("description");
	const fromRequestId = formData.get("fromRequestId");
	const callTime = formData.get("callTime");
	const performerIds = formData.getAll("performerIds");
	const formTimezone = formData.get("timezone");
	const timezone =
		typeof formTimezone === "string" && formTimezone ? formTimezone : (user.timezone ?? undefined);

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

	const event = await createEvent({
		groupId,
		title: title.trim(),
		description: typeof description === "string" ? description.trim() || undefined : undefined,
		eventType: eventType as "rehearsal" | "show" | "other",
		startTime: localTimeToUTC(date, startTime, timezone),
		endTime: localTimeToUTC(date, endTime, timezone),
		location: typeof location === "string" ? location.trim() || undefined : undefined,
		createdById: user.id,
		createdFromRequestId:
			typeof fromRequestId === "string" && fromRequestId ? fromRequestId : undefined,
		callTime: hasCallTime ? localTimeToUTC(date, callTime.trim(), timezone) : undefined,
		timezone,
	});

	// Auto-assign available/maybe members when creating from an availability request
	const validFromRequestIdForAssign =
		typeof fromRequestId === "string" && fromRequestId ? fromRequestId : null;
	if (validFromRequestIdForAssign && typeof date === "string") {
		// Validate the availability request belongs to this group (IDOR prevention)
		const requestGroupId = await getAvailabilityRequestGroupId(validFromRequestIdForAssign);
		if (requestGroupId === groupId) {
			await autoAssignFromAvailability(event.id, validFromRequestIdForAssign, date, user.id);
		}
	}

	// Assign performers for show events (onConflictDoNothing handles overlap with auto-assign)
	if (eventType === "show") {
		const validPerformerIds = performerIds.filter(
			(id): id is string => typeof id === "string" && id.length > 0,
		);
		if (validPerformerIds.length > 0) {
			// Verify all provided performerIds are actual members of this group
			const groupData = await getGroupWithMembers(groupId);
			const memberIds = new Set(groupData?.members.map((m) => m.id) ?? []);
			const verifiedIds = validPerformerIds.filter((id) => memberIds.has(id));
			if (verifiedIds.length > 0) {
				await bulkAssignToEvent(event.id, verifiedIds, "Performer");
			}
		}
	}

	// Fire-and-forget email notifications
	const appUrl = process.env.APP_URL ?? "http://localhost:5173";
	const eventUrl = `${appUrl}/groups/${groupId}/events/${event.id}`;
	const preferencesUrl = `${appUrl}/groups/${groupId}/notifications`;
	const validFromRequestId =
		typeof fromRequestId === "string" && fromRequestId ? fromRequestId : null;

	void (async () => {
		const [groupData, membersWithPrefs] = await Promise.all([
			getGroupWithMembers(groupId),
			getGroupMembersWithPreferences(groupId),
		]);
		if (!groupData) return;

		const prefsMap = new Map(membersWithPrefs.map((m) => [m.id, m.notificationPreferences]));

		if (validFromRequestId && typeof date === "string") {
			// Availability-aware notifications
			const availData = await getAvailabilityForEventDate(validFromRequestId, date);
			const memberMap = new Map(
				groupData.members.map((m) => [
					m.id,
					{
						email: m.email,
						name: m.name,
						timezone: m.timezone,
						notificationPreferences: prefsMap.get(m.id),
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
			const respondedUserIds = new Set<string>();

			for (const entry of availData) {
				if (entry.userId === user.id) {
					respondedUserIds.add(entry.userId);
					continue;
				}
				respondedUserIds.add(entry.userId);
				const member = memberMap.get(entry.userId);
				if (!member) continue;
				if (entry.status === "available") {
					availableRecipients.push(member);
				} else if (entry.status === "maybe") {
					maybeRecipients.push(member);
				}
				// not_available → no email
			}

			// Members who didn't respond at all
			const noResponseRecipients = groupData.members
				.filter((m) => m.id !== user.id && !respondedUserIds.has(m.id))
				.map((m) => ({
					email: m.email,
					name: m.name,
					timezone: m.timezone,
					notificationPreferences: prefsMap.get(m.id),
				}));

			void sendEventFromAvailabilityNotification({
				eventTitle: event.title,
				eventType: event.eventType,
				startTime: event.startTime,
				endTime: event.endTime,
				location: event.location ?? undefined,
				groupName: groupData.group.name,
				eventUrl,
				availableRecipients,
				maybeRecipients,
				noResponseRecipients,
				preferencesUrl,
			});
		} else {
			// Standard notification
			const recipients = groupData.members
				.filter((m) => m.id !== user.id)
				.map((m) => ({
					email: m.email,
					name: m.name,
					timezone: m.timezone,
					notificationPreferences: prefsMap.get(m.id),
				}));
			if (recipients.length === 0) return;

			void sendEventCreatedNotification({
				eventTitle: event.title,
				eventType: event.eventType,
				startTime: event.startTime,
				endTime: event.endTime,
				location: event.location ?? undefined,
				groupName: groupData.group.name,
				recipients,
				eventUrl,
				preferencesUrl,
			});
		}

		// Fire-and-forget Discord webhook
		if (groupData.group.webhookUrl) {
			const tz = event.timezone ?? undefined;
			const webhookDateTime = formatEventTime(event.startTime, event.endTime, tz);
			const tzAbbrev = getTimezoneAbbreviation(event.startTime, tz);
			const webhookCallTime = event.callTime ? formatTime(event.callTime, tz) : null;
			sendEventCreatedWebhook(groupData.group.webhookUrl, {
				groupName: groupData.group.name,
				eventTitle: event.title,
				eventType: event.eventType,
				dateTime: tzAbbrev ? `${webhookDateTime} (${tzAbbrev})` : webhookDateTime,
				location: event.location ?? undefined,
				callTime: webhookCallTime
					? tzAbbrev
						? `${webhookCallTime} (${tzAbbrev})`
						: webhookCallTime
					: undefined,
				eventUrl,
			});
		}
	})();

	return redirect(`/groups/${groupId}/events/${event.id}`);
}

export default function NewEvent() {
	const { groupId } = useParams();
	const { fromRequest, prefillDate, members, availabilityData, userTimezone } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const [eventType, setEventType] = useState("rehearsal");
	const [timezone, setTimezone] = useState(
		() => userTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
	);
	const [selectedPerformers, setSelectedPerformers] = useState<Set<string>>(() => {
		// Pre-select available members when creating from availability
		if (availabilityData.length > 0) {
			return new Set(availabilityData.filter((a) => a.status === "available").map((a) => a.userId));
		}
		return new Set();
	});

	const isShow = eventType === "show";

	const togglePerformer = (id: string) => {
		const next = new Set(selectedPerformers);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedPerformers(next);
	};

	const availableMembers = availabilityData.filter((a) => a.status === "available");
	const maybeMembers = availabilityData.filter((a) => a.status === "maybe");
	const unavailableMembers = availabilityData.filter((a) => a.status === "not_available");
	const hasAvailData = availabilityData.length > 0;

	// Members who didn't respond to availability
	const respondedUserIds = new Set(availabilityData.map((a) => a.userId));
	const noResponseMembers = hasAvailData ? members.filter((m) => !respondedUserIds.has(m.id)) : [];

	return (
		<div className="max-w-3xl">
			<div className="mb-6">
				<Link
					to={`/groups/${groupId}/events`}
					className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Events
				</Link>
				<h2 className="mt-2 text-2xl font-bold text-slate-900">Create Event</h2>
				{fromRequest && (
					<div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
						Creating from availability request:{" "}
						<Link
							to={`/groups/${groupId}/availability/${fromRequest.id}`}
							className="font-medium underline hover:text-emerald-800"
						>
							{fromRequest.title}
						</Link>
					</div>
				)}
			</div>

			{actionData && "error" in actionData && (
				<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			<Form method="post" className="space-y-6">
				<CsrfInput />
				{fromRequest && <input type="hidden" name="fromRequestId" value={fromRequest.id} />}
				{Array.from(selectedPerformers).map((id) => (
					<input key={id} type="hidden" name="performerIds" value={id} />
				))}

				{/* Title & Type */}
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
								placeholder="e.g., Friday Night Show"
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<span className="block text-sm font-medium text-slate-700">
								Event Type <span className="text-red-500">*</span>
							</span>
							<EventTypeSelector onChange={(value) => setEventType(value)} />
						</div>
					</div>
				</div>

				{/* Date & Time */}
				<EventDateTimeInputs
					defaultDate={prefillDate ?? ""}
					timezone={timezone}
					onTimezoneChange={setTimezone}
					isShow={isShow}
				/>

				{/* Cast Assignment — show only */}
				{isShow && members.length > 0 && (
					<div className="rounded-xl border border-purple-200 bg-white p-6 shadow-sm">
						<h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
							<Users className="h-4 w-4 text-purple-500" />
							Cast Assignment
						</h3>
						<p className="mb-4 text-xs text-slate-500">
							Select performers for this show. Other group members can self-register as viewers.
						</p>

						{hasAvailData ? (
							<div className="space-y-3">
								{availableMembers.length > 0 && (
									<div>
										<h4 className="mb-1.5 text-xs font-semibold text-emerald-700">✅ Available</h4>
										<UserChipSelector
											users={availableMembers.map((u) => ({ id: u.userId, name: u.userName }))}
											selectedIds={selectedPerformers}
											onToggle={togglePerformer}
											colorScheme="emerald"
										/>
									</div>
								)}
								{maybeMembers.length > 0 && (
									<div>
										<h4 className="mb-1.5 text-xs font-semibold text-amber-700">🤔 Maybe</h4>
										<UserChipSelector
											users={maybeMembers.map((u) => ({ id: u.userId, name: u.userName }))}
											selectedIds={selectedPerformers}
											onToggle={togglePerformer}
											colorScheme="amber"
										/>
									</div>
								)}
								{unavailableMembers.length > 0 && (
									<div>
										<h4 className="mb-1.5 text-xs font-semibold text-slate-500">
											❌ Not Available
										</h4>
										<UserChipSelector
											users={unavailableMembers.map((u) => ({ id: u.userId, name: u.userName }))}
											selectedIds={selectedPerformers}
											onToggle={togglePerformer}
											colorScheme="red"
											dimmed
										/>
									</div>
								)}
								{noResponseMembers.length > 0 && (
									<div>
										<h4 className="mb-1.5 text-xs font-semibold text-slate-400">— No Response</h4>
										<UserChipSelector
											users={noResponseMembers.map((m) => ({ id: m.id, name: m.name }))}
											selectedIds={selectedPerformers}
											onToggle={togglePerformer}
											colorScheme="slate"
										/>
									</div>
								)}
							</div>
						) : (
							<UserChipSelector
								users={members.map((m) => ({ id: m.id, name: m.name }))}
								selectedIds={selectedPerformers}
								onToggle={togglePerformer}
								colorScheme="purple"
							/>
						)}

						{selectedPerformers.size > 0 && (
							<p className="mt-3 text-xs text-purple-600">
								{selectedPerformers.size} performer{selectedPerformers.size !== 1 ? "s" : ""}{" "}
								selected
							</p>
						)}
					</div>
				)}

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
								placeholder="e.g., Studio A, Main Theater"
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
								placeholder="Any additional details..."
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
				</div>

				{/* Submit */}
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? "Creating..." : "Create Event"}
					</button>
					<Link
						to={`/groups/${groupId}/events`}
						className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						Cancel
					</Link>
				</div>
			</Form>
		</div>
	);
}
