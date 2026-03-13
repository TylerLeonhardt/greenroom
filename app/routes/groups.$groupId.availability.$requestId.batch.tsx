import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useLoaderData,
	useNavigation,
	useSearchParams,
} from "@remix-run/react";
import { ArrowLeft, Calendar, CheckCircle2, Clock, Copy, MapPin } from "lucide-react";
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import { formatDateDisplay, formatTimeRange } from "~/lib/date-utils";
import { getAvailabilityRequest } from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { requireGroupAdminOrPermission } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Create Batch Events — My Call Time" }];
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
	const selectedDatesParam = url.searchParams.get("dates");
	const selectedDates = selectedDatesParam ? selectedDatesParam.split(",") : [];

	if (selectedDates.length === 0) {
		return redirect(`/groups/${groupId}/availability/${requestId}`);
	}

	return {
		availRequest,
		selectedDates,
		groupId,
		requestId,
		userTimezone: user.timezone,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const requestId = params.requestId ?? "";
	const user = await requireGroupAdminOrPermission(request, groupId, "membersCanCreateEvents");
	const formData = await request.formData();
	await validateCsrfToken(request, formData);

	const intent = formData.get("intent");

	if (intent === "create") {
		// For now, just redirect to success page
		// In a real implementation, we'd call createEventsFromAvailability here
		const dates = formData.get("dates");
		const datesArray = typeof dates === "string" ? dates.split(",") : [];

		// Mock validation
		const title = formData.get("title");
		const eventType = formData.get("eventType");
		const defaultTime = formData.get("defaultTime");

		if (!title || typeof title !== "string" || title.trim().length === 0) {
			return { error: "Title is required." };
		}

		if (!eventType || !["rehearsal", "show", "other"].includes(eventType as string)) {
			return { error: "Event type is required." };
		}

		// Mock success - in real implementation, create events here
		return redirect(
			`/groups/${groupId}/availability/${requestId}?batchSuccess=true&count=${datesArray.length}`,
		);
	}

	return { error: "Invalid action." };
}

export default function BatchEventConfiguration() {
	const { availRequest, selectedDates, groupId, requestId, userTimezone } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const [step, setStep] = useState<"configure" | "review">("configure");

	const timeRange = formatTimeRange(availRequest.requestedStartTime, availRequest.requestedEndTime);
	const defaultStartTime = availRequest.requestedStartTime || "19:00";
	const defaultEndTime = availRequest.requestedEndTime || "21:00";

	// Form state
	const [title, setTitle] = useState(availRequest.title);
	const [description, setDescription] = useState("");
	const [eventType, setEventType] = useState<"rehearsal" | "show" | "other">("rehearsal");
	const [defaultTime, setDefaultTime] = useState(`${defaultStartTime}-${defaultEndTime}`);
	const [locations, setLocations] = useState<Record<string, string>>(
		Object.fromEntries(selectedDates.map((date) => [date, ""])),
	);
	const [applyToAllLocation, setApplyToAllLocation] = useState("");

	const handleApplyToAll = () => {
		if (applyToAllLocation.trim()) {
			const newLocations: Record<string, string> = {};
			for (const date of selectedDates) {
				newLocations[date] = applyToAllLocation;
			}
			setLocations(newLocations);
		}
	};

	const handleLocationChange = (date: string, value: string) => {
		setLocations((prev) => ({ ...prev, [date]: value }));
	};

	return (
		<div className="mx-auto max-w-4xl pb-12">
			{/* Header */}
			<div className="mb-6">
				<Link
					to={`/groups/${groupId}/availability/${requestId}`}
					className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Results
				</Link>
				<h2 className="mt-2 text-2xl font-bold text-slate-900">
					Create {selectedDates.length} Events
				</h2>
				<p className="mt-1 text-sm text-slate-600">
					Configure your batch event creation. Each date will create a separate event with one consolidated notification.
				</p>
			</div>

			{/* Error display */}
			{actionData && "error" in actionData && (
				<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			{/* Step indicator */}
			<div className="mb-8 flex items-center gap-4">
				<button
					type="button"
					onClick={() => setStep("configure")}
					className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
						step === "configure"
							? "bg-emerald-100 text-emerald-900"
							: "bg-slate-100 text-slate-600 hover:bg-slate-200"
					}`}
				>
					<div
						className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
							step === "configure" ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"
						}`}
					>
						1
					</div>
					Configure
				</button>
				<div className="h-px flex-1 bg-slate-200" />
				<button
					type="button"
					onClick={() => setStep("review")}
					className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
						step === "review"
							? "bg-emerald-100 text-emerald-900"
							: "bg-slate-100 text-slate-600 hover:bg-slate-200"
					}`}
				>
					<div
						className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
							step === "review" ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"
						}`}
					>
						2
					</div>
					Review
				</button>
			</div>

			{/* Configure step */}
			{step === "configure" && (
				<Form method="post" className="space-y-6">
					<CsrfInput />
					<input type="hidden" name="intent" value="create" />
					<input type="hidden" name="dates" value={selectedDates.join(",")} />

					{/* Shared fields */}
					<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 className="mb-4 text-lg font-semibold text-slate-900">Shared Information</h3>

						<div className="space-y-4">
							<div>
								<label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
									Event Title
								</label>
								<input
									type="text"
									id="title"
									name="title"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
									placeholder="e.g., Weekly Rehearsal"
									required
								/>
								<p className="mt-1 text-xs text-slate-500">
									This title will be used for all {selectedDates.length} events
								</p>
							</div>

							<div>
								<label htmlFor="eventType" className="mb-1 block text-sm font-medium text-slate-700">
									Event Type
								</label>
								<select
									id="eventType"
									name="eventType"
									value={eventType}
									onChange={(e) => setEventType(e.target.value as "rehearsal" | "show" | "other")}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
									required
								>
									<option value="rehearsal">🎯 Rehearsal</option>
									<option value="show">🎭 Show</option>
									<option value="other">📅 Other</option>
								</select>
							</div>

							<div>
								<label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
									Description (Optional)
								</label>
								<textarea
									id="description"
									name="description"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={3}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
									placeholder="Additional details about these events..."
								/>
							</div>

							<div>
								<label htmlFor="defaultTime" className="mb-1 block text-sm font-medium text-slate-700">
									Default Time
								</label>
								<div className="flex items-center gap-2">
									<Clock className="h-4 w-4 text-slate-400" />
									<input
										type="text"
										id="defaultTime"
										name="defaultTime"
										value={defaultTime}
										onChange={(e) => setDefaultTime(e.target.value)}
										className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
										placeholder="e.g., 19:00-21:00"
									/>
								</div>
								<p className="mt-1 text-xs text-slate-500">
									Format: HH:MM-HH:MM (24-hour format)
								</p>
							</div>
						</div>
					</div>

					{/* Per-date locations */}
					<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 className="mb-4 text-lg font-semibold text-slate-900">Locations</h3>

						{/* Apply to all helper */}
						<div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
							<label htmlFor="applyToAll" className="mb-2 block text-sm font-medium text-emerald-900">
								<MapPin className="mb-1 inline h-4 w-4" /> Quick Fill: Apply Location to All
							</label>
							<div className="flex gap-2">
								<input
									type="text"
									id="applyToAll"
									value={applyToAllLocation}
									onChange={(e) => setApplyToAllLocation(e.target.value)}
									className="flex-1 rounded-lg border border-emerald-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
									placeholder="e.g., Studio A"
								/>
								<button
									type="button"
									onClick={handleApplyToAll}
									className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
								>
									<Copy className="h-4 w-4" />
									Apply
								</button>
							</div>
						</div>

						{/* Individual date locations */}
						<div className="space-y-3">
							{selectedDates.map((date) => {
								const { dayOfWeek, display } = formatDateDisplay(date, userTimezone ?? undefined);
								return (
									<div
										key={date}
										className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
									>
										<div className="flex-shrink-0">
											<div className="text-sm font-medium text-slate-900">{display}</div>
											<div className="text-xs text-slate-500">{dayOfWeek}</div>
										</div>
										<input
											type="text"
											name={`location-${date}`}
											value={locations[date] || ""}
											onChange={(e) => handleLocationChange(date, e.target.value)}
											className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
											placeholder="Location (optional)"
										/>
									</div>
								);
							})}
						</div>
					</div>

					{/* Actions */}
					<div className="flex items-center justify-between">
						<Link
							to={`/groups/${groupId}/availability/${requestId}`}
							className="text-sm font-medium text-slate-600 hover:text-slate-900"
						>
							Cancel
						</Link>
						<button
							type="button"
							onClick={() => setStep("review")}
							className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700"
						>
							Review Events →
						</button>
					</div>
				</Form>
			)}

			{/* Review step */}
			{step === "review" && (
				<div className="space-y-6">
					{/* Summary banner */}
					<div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-6">
						<div className="flex items-start gap-4">
							<div className="rounded-full bg-emerald-200 p-3">
								<Calendar className="h-6 w-6 text-emerald-700" />
							</div>
							<div className="flex-1">
								<h3 className="text-lg font-semibold text-emerald-900">Ready to Create</h3>
								<p className="mt-1 text-sm text-emerald-700">
									You're about to create <strong>{selectedDates.length} events</strong> with the title
									"<strong>{title}</strong>". One notification email will be sent to the group.
								</p>
							</div>
						</div>
					</div>

					{/* Event list */}
					<div className="space-y-3">
						<h3 className="text-lg font-semibold text-slate-900">Events to Create</h3>
						{selectedDates.map((date, idx) => {
							const { dayOfWeek, display } = formatDateDisplay(date, userTimezone ?? undefined);
							const location = locations[date] || "No location specified";
							return (
								<div
									key={date}
									className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
								>
									<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-emerald-700">
										{idx + 1}
									</div>
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<h4 className="font-semibold text-slate-900">{title}</h4>
											<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
												{eventType}
											</span>
										</div>
										<div className="mt-1 space-y-0.5 text-sm text-slate-600">
											<div className="flex items-center gap-1.5">
												<Calendar className="h-3.5 w-3.5" />
												{display} ({dayOfWeek})
											</div>
											<div className="flex items-center gap-1.5">
												<Clock className="h-3.5 w-3.5" />
												{defaultTime}
											</div>
											<div className="flex items-center gap-1.5">
												<MapPin className="h-3.5 w-3.5" />
												{location}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>

					{/* Final actions */}
					<Form method="post" className="flex items-center justify-between">
						<CsrfInput />
						<input type="hidden" name="intent" value="create" />
						<input type="hidden" name="dates" value={selectedDates.join(",")} />
						<input type="hidden" name="title" value={title} />
						<input type="hidden" name="eventType" value={eventType} />
						<input type="hidden" name="defaultTime" value={defaultTime} />
						<input type="hidden" name="description" value={description} />
						{selectedDates.map((date) => (
							<input key={date} type="hidden" name={`location-${date}`} value={locations[date] || ""} />
						))}

						<button
							type="button"
							onClick={() => setStep("configure")}
							className="text-sm font-medium text-slate-600 hover:text-slate-900"
						>
							← Back to Configuration
						</button>

						<button
							type="submit"
							disabled={isSubmitting}
							className="flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
						>
							{isSubmitting ? (
								"Creating..."
							) : (
								<>
									<CheckCircle2 className="h-5 w-5" />
									Create {selectedDates.length} Events & Notify
								</>
							)}
						</button>
					</Form>
				</div>
			)}
		</div>
	);
}
