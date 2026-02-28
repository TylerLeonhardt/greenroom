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
import { ArrowLeft, Clock, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteEvent, getEventWithAssignments, updateEvent } from "~/services/events.server";
import { requireGroupAdmin } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Edit Event — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const eventId = params.eventId ?? "";
	await requireGroupAdmin(request, groupId);

	const data = await getEventWithAssignments(eventId);
	if (!data || data.event.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	const start = new Date(data.event.startTime);
	const end = new Date(data.event.endTime);
	const ct = data.event.callTime ? new Date(data.event.callTime) : null;

	return {
		event: data.event,
		prefill: {
			date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
			startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
			endTime: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
			callTime: ct
				? `${String(ct.getHours()).padStart(2, "0")}:${String(ct.getMinutes()).padStart(2, "0")}`
				: "",
		},
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const eventId = params.eventId ?? "";
	await requireGroupAdmin(request, groupId);

	// Verify the event belongs to this group before any mutation
	const data = await getEventWithAssignments(eventId);
	if (!data || data.event.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	const formData = await request.formData();
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

	await updateEvent(eventId, {
		title: title.trim(),
		description: typeof description === "string" ? description : undefined,
		eventType,
		startTime: new Date(`${date}T${startTime}:00`),
		endTime: new Date(`${date}T${endTime}:00`),
		location: typeof location === "string" ? location : undefined,
		callTime: hasCallTime
			? new Date(`${date}T${callTime}:00`)
			: eventType === "show"
				? undefined
				: null,
	});

	return redirect(`/groups/${groupId}/events/${eventId}`);
}

export default function EditEvent() {
	const { groupId } = useParams();
	const { event, prefill } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const [eventType, setEventType] = useState(event.eventType);
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
											defaultChecked={event.eventType === type.value}
											onChange={() => setEventType(type.value as "rehearsal" | "show" | "other")}
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
								defaultValue={prefill.date}
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
								defaultValue={prefill.startTime}
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
								defaultValue={prefill.endTime}
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
								defaultValue={prefill.callTime}
								className="mt-1 block w-full max-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
							/>
						</div>
					)}
				</div>

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
			<div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
				<h3 className="text-sm font-semibold text-red-900">Danger Zone</h3>
				<p className="mt-1 text-xs text-red-700">
					Deleting this event will remove all assignments and cannot be undone.
				</p>
				<Form method="post" className="mt-4">
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
			</div>
		</div>
	);
}
