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
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import { DateSelector } from "~/components/date-selector";
import { formatDateShort, formatTimeRange } from "~/lib/date-utils";
import {
	detectAvailabilityRequestChanges,
	formatAvailabilityRequestChangeSummary,
	hasAnyAvailabilityRequestChanges,
} from "~/lib/edit-utils";
import { getAvailabilityRequest, updateAvailabilityRequest } from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { sendAvailabilityRequestEditedNotification } from "~/services/email.server";
import {
	getGroupById,
	getGroupMembersWithPreferences,
	isGroupAdmin,
	requireGroupMember,
} from "~/services/groups.server";
import { sendAvailabilityRequestEditedWebhook } from "~/services/webhook.server";

export const meta: MetaFunction = () => {
	return [{ title: "Edit Availability Request \u2014 My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const requestId = params.requestId ?? "";
	const user = await requireGroupMember(request, groupId);
	const admin = await isGroupAdmin(user.id, groupId);

	const availRequest = await getAvailabilityRequest(requestId);
	if (!availRequest || availRequest.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	if (!admin && availRequest.createdById !== user.id) {
		throw new Response("Forbidden", { status: 403 });
	}

	return { availRequest };
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const requestId = params.requestId ?? "";
	const user = await requireGroupMember(request, groupId);
	const admin = await isGroupAdmin(user.id, groupId);

	const availRequest = await getAvailabilityRequest(requestId);
	if (!availRequest || availRequest.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	if (!admin && availRequest.createdById !== user.id) {
		throw new Response("Forbidden", { status: 403 });
	}

	const formData = await request.formData();
	await validateCsrfToken(request, formData);

	const title = formData.get("title");
	const description = formData.get("description");
	const selectedDatesRaw = formData.get("selectedDates");
	const notifyMembers = formData.get("notifyMembers") === "on";

	if (typeof title !== "string" || !title.trim()) {
		return { error: "Title is required." };
	}
	if (title.trim().length > 200) {
		return { error: "Title must be 200 characters or less." };
	}
	if (typeof description === "string" && description.trim().length > 2000) {
		return { error: "Description must be 2,000 characters or less." };
	}

	let selectedDates: string[] = [];
	try {
		selectedDates = JSON.parse(typeof selectedDatesRaw === "string" ? selectedDatesRaw : "[]");
	} catch {
		return { error: "Invalid date selection." };
	}
	if (!Array.isArray(selectedDates) || selectedDates.length === 0) {
		return { error: "Please select at least one date." };
	}
	const datePattern = /^\d{4}-\d{2}-\d{2}$/;
	if (!selectedDates.every((d) => typeof d === "string" && datePattern.test(d))) {
		return { error: "Invalid date format." };
	}

	const sortedDates = [...selectedDates].sort();
	const dateRangeStart = new Date(sortedDates[0] + "T00:00:00");
	const dateRangeEnd = new Date(sortedDates[sortedDates.length - 1] + "T00:00:00");

	const changes = detectAvailabilityRequestChanges(
		{
			title: availRequest.title,
			description: availRequest.description,
			requestedDates: availRequest.requestedDates as string[],
		},
		{
			title: title.trim(),
			description: typeof description === "string" ? description.trim() || null : null,
			requestedDates: sortedDates,
		},
	);

	if (!hasAnyAvailabilityRequestChanges(changes)) {
		return redirect("/groups/" + groupId + "/availability/" + requestId);
	}

	await updateAvailabilityRequest(requestId, {
		title: title.trim(),
		description: typeof description === "string" ? description.trim() : "",
		requestedDates: sortedDates,
		dateRangeStart,
		dateRangeEnd,
	});

	if (notifyMembers && hasAnyAvailabilityRequestChanges(changes)) {
		const changeSummary = formatAvailabilityRequestChangeSummary(changes);
		const appUrl = process.env.APP_URL ?? "http://localhost:5173";
		const preferencesUrl = appUrl + "/groups/" + groupId + "/notifications";
		const requestUrl = appUrl + "/groups/" + groupId + "/availability/" + requestId;

		void Promise.all([getGroupById(groupId), getGroupMembersWithPreferences(groupId)]).then(
			([group, members]) => {
				if (!group) return;
				const recipients = members
					.filter((m) => m.id !== user.id)
					.map((m) => ({
						email: m.email,
						name: m.name,
						notificationPreferences: m.notificationPreferences,
					}));
				if (recipients.length === 0) return;

				void sendAvailabilityRequestEditedNotification({
					requestTitle: title.trim(),
					groupName: group.name,
					changes: changeSummary,
					recipients,
					requestUrl,
					preferencesUrl,
				});

				if (group.webhookUrl) {
					sendAvailabilityRequestEditedWebhook(group.webhookUrl, {
						groupName: group.name,
						title: title.trim(),
						changes: changeSummary,
						requestUrl,
					});
				}
			},
		);
	}

	return redirect("/groups/" + groupId + "/availability/" + requestId);
}

export default function EditAvailabilityRequest() {
	const { groupId } = useParams();
	const { availRequest } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const existingDates = availRequest.requestedDates as string[];
	const [selectedDates, setSelectedDates] = useState<string[]>(existingDates);
	const timeRange = formatTimeRange(availRequest.requestedStartTime, availRequest.requestedEndTime);
	const hasTimeRange = timeRange !== "All day";

	const sortedExisting = [...existingDates].sort();
	const defaultStart = sortedExisting[0] ?? new Date().toISOString().split("T")[0];
	const defaultEnd =
		sortedExisting[sortedExisting.length - 1] ?? new Date().toISOString().split("T")[0];
	const [dateRangeStart, setDateRangeStart] = useState(defaultStart);
	const [dateRangeEnd, setDateRangeEnd] = useState(defaultEnd);

	return (
		<div className="max-w-3xl">
			<div className="mb-6">
				<Link
					to={`/groups/${groupId}/availability/${availRequest.id}`}
					className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Request
				</Link>
				<h2 className="mt-2 text-2xl font-bold text-slate-900">Edit Availability Request</h2>
			</div>

			{actionData && "error" in actionData && (
				<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			<Form method="post" className="space-y-6">
				<CsrfInput />
				<input type="hidden" name="selectedDates" value={JSON.stringify(selectedDates)} />

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
								defaultValue={availRequest.title}
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
								defaultValue={availRequest.description ?? ""}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="mb-4 text-sm font-semibold text-slate-900">Dates</h3>
					{hasTimeRange && (
						<p className="mb-4 text-xs text-slate-500">
							\u23F0 Time range: {timeRange} (set at creation, cannot be changed)
						</p>
					)}
					<div className="mb-4 grid gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="dateRangeStart" className="block text-sm font-medium text-slate-700">
								Range Start
							</label>
							<input
								id="dateRangeStart"
								type="date"
								value={dateRangeStart}
								onChange={(e) => setDateRangeStart(e.target.value)}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="dateRangeEnd" className="block text-sm font-medium text-slate-700">
								Range End
							</label>
							<input
								id="dateRangeEnd"
								type="date"
								value={dateRangeEnd}
								min={dateRangeStart || undefined}
								onChange={(e) => setDateRangeEnd(e.target.value)}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
					<DateSelector
						startDate={dateRangeStart}
						endDate={dateRangeEnd}
						selectedDates={selectedDates}
						onChange={setSelectedDates}
					/>
					{selectedDates.length > 0 && (
						<p className="mt-3 text-xs text-slate-500">
							{selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected:{" "}
							{[...selectedDates]
								.sort()
								.map((d) => formatDateShort(d + "T00:00:00"))
								.join(", ")}
						</p>
					)}
				</div>

				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="mb-3 text-sm font-semibold text-slate-900">Notification Options</h3>
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
				</div>

				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={isSubmitting || selectedDates.length === 0}
						className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? "Saving..." : "Save Changes"}
					</button>
					<Link
						to={`/groups/${groupId}/availability/${availRequest.id}`}
						className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						Cancel
					</Link>
				</div>
			</Form>
		</div>
	);
}
