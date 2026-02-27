import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, redirect, useActionData, useNavigation, useParams } from "@remix-run/react";
import { useState } from "react";
import { DateSelector } from "~/components/date-selector";
import { createAvailabilityRequest } from "~/services/availability.server";
import { sendAvailabilityRequestNotification } from "~/services/email.server";
import { getGroupWithMembers, requireGroupAdmin } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "New Availability Request — GreenRoom" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupAdmin(request, groupId);
	return {};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupAdmin(request, groupId);
	const formData = await request.formData();

	const title = formData.get("title");
	const description = formData.get("description");
	const dateRangeStart = formData.get("dateRangeStart");
	const dateRangeEnd = formData.get("dateRangeEnd");
	const selectedDatesRaw = formData.get("selectedDates");
	const expiresAt = formData.get("expiresAt");

	if (typeof title !== "string" || !title.trim()) {
		return { error: "Title is required." };
	}
	if (typeof dateRangeStart !== "string" || !dateRangeStart) {
		return { error: "Start date is required." };
	}
	if (typeof dateRangeEnd !== "string" || !dateRangeEnd) {
		return { error: "End date is required." };
	}
	if (dateRangeStart > dateRangeEnd) {
		return { error: "Start date must be before end date." };
	}

	let selectedDates: string[] = [];
	try {
		selectedDates = JSON.parse(typeof selectedDatesRaw === "string" ? selectedDatesRaw : "[]");
	} catch {
		return { error: "Invalid date selection." };
	}
	if (selectedDates.length === 0) {
		return { error: "Please select at least one date." };
	}

	const req = await createAvailabilityRequest({
		groupId,
		title: title.trim(),
		description: typeof description === "string" ? description.trim() || undefined : undefined,
		dateRangeStart: new Date(`${dateRangeStart}T00:00:00`),
		dateRangeEnd: new Date(`${dateRangeEnd}T00:00:00`),
		requestedDates: selectedDates,
		createdById: user.id,
		expiresAt:
			typeof expiresAt === "string" && expiresAt ? new Date(`${expiresAt}T23:59:59`) : undefined,
	});

	// Fire-and-forget email notification to group members
	const appUrl = process.env.APP_URL ?? "http://localhost:5173";
	void getGroupWithMembers(groupId).then((groupData) => {
		if (!groupData) return;
		const recipients = groupData.members
			.filter((m) => m.id !== user.id)
			.map((m) => ({ email: m.email, name: m.name }));
		if (recipients.length === 0) return;

		const startDate = new Date(`${dateRangeStart}T00:00:00`);
		const endDate = new Date(`${dateRangeEnd}T00:00:00`);
		const dateRange = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

		void sendAvailabilityRequestNotification({
			requestId: req.id,
			requestTitle: req.title,
			groupName: groupData.group.name,
			dateRange,
			createdByName: user.name,
			recipients,
			requestUrl: `${appUrl}/groups/${groupId}/availability/${req.id}`,
		});
	});

	return redirect(`/groups/${groupId}/availability/${req.id}`);
}

export default function NewAvailabilityRequest() {
	const { groupId } = useParams();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const [dateRangeStart, setDateRangeStart] = useState("");
	const [dateRangeEnd, setDateRangeEnd] = useState("");
	const [selectedDates, setSelectedDates] = useState<string[]>([]);

	return (
		<div className="max-w-3xl">
			<div className="mb-6">
				<Link
					to={`/groups/${groupId}/availability`}
					className="text-sm text-slate-500 hover:text-slate-700"
				>
					← Back to Availability
				</Link>
				<h2 className="mt-2 text-2xl font-bold text-slate-900">Create Availability Request</h2>
				<p className="mt-1 text-sm text-slate-600">Ask your group when they&apos;re free</p>
			</div>

			{actionData && "error" in actionData && (
				<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			<Form method="post" className="space-y-6">
				<input type="hidden" name="selectedDates" value={JSON.stringify(selectedDates)} />

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
								placeholder="e.g., March Rehearsal Schedule"
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
								rows={2}
								placeholder="Any additional context for the group..."
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
				</div>

				{/* Date Range */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="mb-4 text-sm font-semibold text-slate-900">Date Range</h3>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label htmlFor="dateRangeStart" className="block text-sm font-medium text-slate-700">
								Start Date <span className="text-red-500">*</span>
							</label>
							<input
								id="dateRangeStart"
								name="dateRangeStart"
								type="date"
								required
								value={dateRangeStart}
								onChange={(e) => {
									setDateRangeStart(e.target.value);
									setSelectedDates([]);
								}}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="dateRangeEnd" className="block text-sm font-medium text-slate-700">
								End Date <span className="text-red-500">*</span>
							</label>
							<input
								id="dateRangeEnd"
								name="dateRangeEnd"
								type="date"
								required
								value={dateRangeEnd}
								min={dateRangeStart || undefined}
								onChange={(e) => {
									setDateRangeEnd(e.target.value);
									setSelectedDates([]);
								}}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
				</div>

				{/* Day Selection */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="mb-4 text-sm font-semibold text-slate-900">Select Days</h3>
					<DateSelector
						startDate={dateRangeStart}
						endDate={dateRangeEnd}
						selectedDates={selectedDates}
						onChange={setSelectedDates}
					/>
				</div>

				{/* Expiration */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="mb-4 text-sm font-semibold text-slate-900">
						Response Deadline (optional)
					</h3>
					<div className="max-w-xs">
						<input
							name="expiresAt"
							type="date"
							className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
						/>
						<p className="mt-1 text-xs text-slate-500">
							Responses will still be accepted after this date
						</p>
					</div>
				</div>

				{/* Preview */}
				{selectedDates.length > 0 && (
					<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
						<h3 className="text-sm font-semibold text-emerald-900">Preview</h3>
						<p className="mt-1 text-xs text-emerald-700">
							{selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected from{" "}
							{dateRangeStart} to {dateRangeEnd}
						</p>
						<div className="mt-3 flex flex-wrap gap-1.5">
							{selectedDates.map((d) => (
								<span
									key={d}
									className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
								>
									{new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
										weekday: "short",
									})}
								</span>
							))}
						</div>
					</div>
				)}

				{/* Submit */}
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={isSubmitting || selectedDates.length === 0}
						className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? "Creating..." : "Create Request"}
					</button>
					<Link
						to={`/groups/${groupId}/availability`}
						className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						Cancel
					</Link>
				</div>
			</Form>
		</div>
	);
}
