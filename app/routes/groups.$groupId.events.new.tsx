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
import { ArrowLeft, Clock, Users } from "lucide-react";
import { useState } from "react";
import { getAvailabilityRequest } from "~/services/availability.server";
import {
	sendEventCreatedNotification,
	sendEventFromAvailabilityNotification,
} from "~/services/email.server";
import {
	bulkAssignToEvent,
	createEvent,
	getAvailabilityForEventDate,
} from "~/services/events.server";
import { getGroupWithMembers, requireGroupAdmin } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Create Event — GreenRoom" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupAdmin(request, groupId);

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

	return { fromRequest, prefillDate, members, availabilityData };
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupAdmin(request, groupId);
	const formData = await request.formData();

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

	if (typeof title !== "string" || !title.trim()) {
		return { error: "Title is required." };
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

	const event = await createEvent({
		groupId,
		title: title.trim(),
		description: typeof description === "string" ? description.trim() || undefined : undefined,
		eventType: eventType as "rehearsal" | "show" | "other",
		startTime: new Date(`${date}T${startTime}:00`),
		endTime: new Date(`${date}T${endTime}:00`),
		location: typeof location === "string" ? location.trim() || undefined : undefined,
		createdById: user.id,
		createdFromRequestId:
			typeof fromRequestId === "string" && fromRequestId ? fromRequestId : undefined,
		callTime: hasCallTime ? new Date(`${date}T${callTime}:00`) : undefined,
	});

	// Assign performers for show events
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
	const validFromRequestId =
		typeof fromRequestId === "string" && fromRequestId ? fromRequestId : null;

	void (async () => {
		const groupData = await getGroupWithMembers(groupId);
		if (!groupData) return;

		const eventStart = new Date(`${date}T${startTime}:00`);
		const eventEnd = new Date(`${date}T${endTime}:00`);
		const dateTime = `${eventStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${eventStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${eventEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

		if (validFromRequestId && typeof date === "string") {
			// Availability-aware notifications
			const availData = await getAvailabilityForEventDate(validFromRequestId, date);
			const memberMap = new Map(
				groupData.members.map((m) => [m.id, { email: m.email, name: m.name }]),
			);

			const availableRecipients: Array<{ email: string; name: string }> = [];
			const maybeRecipients: Array<{ email: string; name: string }> = [];
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
				.map((m) => ({ email: m.email, name: m.name }));

			void sendEventFromAvailabilityNotification({
				eventTitle: event.title,
				eventType: event.eventType,
				dateTime,
				location: event.location ?? undefined,
				groupName: groupData.group.name,
				eventUrl,
				availableRecipients,
				maybeRecipients,
				noResponseRecipients,
			});
		} else {
			// Standard notification
			const recipients = groupData.members
				.filter((m) => m.id !== user.id)
				.map((m) => ({ email: m.email, name: m.name }));
			if (recipients.length === 0) return;

			void sendEventCreatedNotification({
				eventTitle: event.title,
				eventType: event.eventType,
				dateTime,
				location: event.location ?? undefined,
				groupName: groupData.group.name,
				recipients,
				eventUrl,
			});
		}
	})();

	return redirect(`/groups/${groupId}/events/${event.id}`);
}

export default function NewEvent() {
	const { groupId } = useParams();
	const { fromRequest, prefillDate, members, availabilityData } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const [eventType, setEventType] = useState("rehearsal");
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
								placeholder="e.g., Friday Night Show"
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<span className="block text-sm font-medium text-slate-700">
								Event Type <span className="text-red-500">*</span>
							</span>
							<div className="mt-2 flex flex-wrap gap-3">
								{[
									{
										value: "rehearsal",
										label: "🎯 Rehearsal",
										color:
											"peer-checked:bg-emerald-100 peer-checked:border-emerald-300 peer-checked:text-emerald-800",
									},
									{
										value: "show",
										label: "🎭 Show",
										color:
											"peer-checked:bg-purple-100 peer-checked:border-purple-300 peer-checked:text-purple-800",
									},
									{
										value: "other",
										label: "📅 Other",
										color:
											"peer-checked:bg-slate-200 peer-checked:border-slate-400 peer-checked:text-slate-800",
									},
								].map((type) => (
									<label key={type.value} className="cursor-pointer">
										<input
											type="radio"
											name="eventType"
											value={type.value}
											defaultChecked={type.value === "rehearsal"}
											onChange={() => setEventType(type.value)}
											className="peer sr-only"
										/>
										<span
											className={`inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 ${type.color}`}
										>
											{type.label}
										</span>
									</label>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Date & Time */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="mb-4 text-sm font-semibold text-slate-900">Date & Time</h3>
					<div className="grid gap-4 sm:grid-cols-3">
						<div>
							<label htmlFor="date" className="block text-sm font-medium text-slate-700">
								Date <span className="text-red-500">*</span>
							</label>
							<input
								id="date"
								name="date"
								type="date"
								required
								defaultValue={prefillDate ?? ""}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="startTime" className="block text-sm font-medium text-slate-700">
								Start Time <span className="text-red-500">*</span>
							</label>
							<input
								id="startTime"
								name="startTime"
								type="time"
								required
								defaultValue="19:00"
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="endTime" className="block text-sm font-medium text-slate-700">
								End Time <span className="text-red-500">*</span>
							</label>
							<input
								id="endTime"
								name="endTime"
								type="time"
								required
								defaultValue="21:00"
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>

					{/* Call Time — show only */}
					{isShow && (
						<div className="mt-4">
							<label htmlFor="callTime" className="block text-sm font-medium text-slate-700">
								<Clock className="mr-1 inline h-4 w-4 text-purple-500" />
								Call Time
								<span className="ml-1 text-xs font-normal text-slate-500">
									(when performers need to arrive)
								</span>
							</label>
							<input
								id="callTime"
								name="callTime"
								type="time"
								defaultValue="18:00"
								className="mt-1 block w-full max-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
							/>
						</div>
					)}
				</div>

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
										<div className="flex flex-wrap gap-2">
											{availableMembers.map((u) => (
												<label
													key={u.userId}
													className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
														selectedPerformers.has(u.userId)
															? "border-emerald-400 bg-emerald-100 text-emerald-800"
															: "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
													}`}
												>
													<input
														type="checkbox"
														className="sr-only"
														checked={selectedPerformers.has(u.userId)}
														onChange={() => togglePerformer(u.userId)}
													/>
													{u.userName}
												</label>
											))}
										</div>
									</div>
								)}
								{maybeMembers.length > 0 && (
									<div>
										<h4 className="mb-1.5 text-xs font-semibold text-amber-700">🤔 Maybe</h4>
										<div className="flex flex-wrap gap-2">
											{maybeMembers.map((u) => (
												<label
													key={u.userId}
													className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
														selectedPerformers.has(u.userId)
															? "border-amber-400 bg-amber-100 text-amber-800"
															: "border-slate-200 bg-white text-slate-700 hover:bg-amber-50"
													}`}
												>
													<input
														type="checkbox"
														className="sr-only"
														checked={selectedPerformers.has(u.userId)}
														onChange={() => togglePerformer(u.userId)}
													/>
													{u.userName}
												</label>
											))}
										</div>
									</div>
								)}
								{unavailableMembers.length > 0 && (
									<div>
										<h4 className="mb-1.5 text-xs font-semibold text-slate-500">
											❌ Not Available
										</h4>
										<div className="flex flex-wrap gap-2">
											{unavailableMembers.map((u) => (
												<label
													key={u.userId}
													className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium opacity-60 transition-colors ${
														selectedPerformers.has(u.userId)
															? "border-red-400 bg-red-100 text-red-800"
															: "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
													}`}
												>
													<input
														type="checkbox"
														className="sr-only"
														checked={selectedPerformers.has(u.userId)}
														onChange={() => togglePerformer(u.userId)}
													/>
													{u.userName}
												</label>
											))}
										</div>
									</div>
								)}
								{noResponseMembers.length > 0 && (
									<div>
										<h4 className="mb-1.5 text-xs font-semibold text-slate-400">— No Response</h4>
										<div className="flex flex-wrap gap-2">
											{noResponseMembers.map((m) => (
												<label
													key={m.id}
													className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
														selectedPerformers.has(m.id)
															? "border-slate-400 bg-slate-200 text-slate-800"
															: "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
													}`}
												>
													<input
														type="checkbox"
														className="sr-only"
														checked={selectedPerformers.has(m.id)}
														onChange={() => togglePerformer(m.id)}
													/>
													{m.name}
												</label>
											))}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="flex flex-wrap gap-2">
								{members.map((m) => (
									<label
										key={m.id}
										className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
											selectedPerformers.has(m.id)
												? "border-purple-400 bg-purple-100 text-purple-800"
												: "border-slate-200 bg-white text-slate-700 hover:bg-purple-50"
										}`}
									>
										<input
											type="checkbox"
											className="sr-only"
											checked={selectedPerformers.has(m.id)}
											onChange={() => togglePerformer(m.id)}
										/>
										{m.name}
									</label>
								))}
							</div>
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
