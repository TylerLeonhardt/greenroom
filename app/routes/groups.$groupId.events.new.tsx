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
import { ArrowLeft } from "lucide-react";
import { getAvailabilityRequest } from "~/services/availability.server";
import { createEvent } from "~/services/events.server";
import { requireGroupAdmin } from "~/services/groups.server";

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
	if (fromRequestId) {
		const req = await getAvailabilityRequest(fromRequestId);
		if (req && req.groupId === groupId) {
			fromRequest = { id: req.id, title: req.title };
		}
	}

	return { fromRequest, prefillDate };
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
	});

	return redirect(`/groups/${groupId}/events/${event.id}`);
}

export default function NewEvent() {
	const { groupId } = useParams();
	const { fromRequest, prefillDate } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

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
