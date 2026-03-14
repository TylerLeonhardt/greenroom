import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
	Form,
	Link,
	redirect,
	useActionData,
	useLoaderData,
	useNavigate,
	useNavigation,
	useRouteLoaderData,
	useSearchParams,
} from "@remix-run/react";
import {
	ArrowLeft,
	Bell,
	Calendar,
	Clock,
	Lock,
	LockOpen,
	Pencil,
	Trash2,
	Users,
} from "lucide-react";
import { useState } from "react";
import { AvailabilityGrid } from "~/components/availability-grid";
import { CsrfInput } from "~/components/csrf-input";
import { ResultsHeatmap } from "~/components/results-heatmap";
import { formatDateMedium, formatTimeRange } from "~/lib/date-utils";
import {
	closeAvailabilityRequest,
	deleteAvailabilityRequest,
	getAggregatedResults,
	getAvailabilityRequest,
	getNonRespondents,
	getReminderSentAt,
	getUserResponse,
	reopenAvailabilityRequest,
	submitAvailabilityResponse,
	updateReminderSentAt,
} from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { sendAvailabilityReminderNotification } from "~/services/email.server";
import { getGroupById, isGroupAdmin, requireGroupMember } from "~/services/groups.server";
import { checkReminderRateLimit } from "~/services/rate-limit.server";
import { sendAvailabilityReminderWebhook } from "~/services/webhook.server";
import type { loader as groupLayoutLoader } from "./groups.$groupId";

type AvailabilityStatus = "available" | "maybe" | "not_available";

export const meta: MetaFunction = () => {
	return [{ title: "Availability Request — My Call Time" }];
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

	const userResponse = await getUserResponse(requestId, user.id);
	const results = admin ? await getAggregatedResults(requestId) : null;
	const nonRespondentCount =
		results && results.totalResponded < results.totalMembers
			? results.totalMembers - results.totalResponded
			: 0;

	// Fetch reminderSentAt separately — gracefully returns null if migration 0012 hasn't run
	const reminderSentAt = await getReminderSentAt(requestId);

	return {
		availRequest,
		userResponse,
		results,
		isAdmin: admin,
		user,
		nonRespondentCount,
		reminderSentAt,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const requestId = params.requestId ?? "";
	const user = await requireGroupMember(request, groupId);

	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	if (intent === "respond") {
		const responsesRaw = formData.get("responses");
		let responses: Record<string, AvailabilityStatus> = {};
		try {
			responses = JSON.parse(typeof responsesRaw === "string" ? responsesRaw : "{}");
		} catch {
			return { error: "Invalid response data." };
		}

		if (Object.keys(responses).length === 0) {
			return { error: "Please respond to at least one date." };
		}

		// Validate response values are valid availability statuses
		const validStatuses: Set<string> = new Set(["available", "maybe", "not_available"]);
		const datePattern = /^\d{4}-\d{2}-\d{2}$/;
		for (const [key, value] of Object.entries(responses)) {
			if (!datePattern.test(key) || !validStatuses.has(value)) {
				return { error: "Invalid response data." };
			}
		}

		await submitAvailabilityResponse({
			requestId,
			userId: user.id,
			responses,
		});

		return { success: true, message: "Response saved!" };
	}

	if (intent === "close" || intent === "reopen") {
		const admin = await isGroupAdmin(user.id, groupId);
		if (!admin) throw new Response("Forbidden", { status: 403 });

		// Verify the availability request belongs to this group
		const availRequest = await getAvailabilityRequest(requestId);
		if (!availRequest || availRequest.groupId !== groupId) {
			throw new Response("Not Found", { status: 404 });
		}

		if (intent === "close") {
			await closeAvailabilityRequest(requestId);
		} else {
			await reopenAvailabilityRequest(requestId);
		}
		return { success: true };
	}

	if (intent === "delete") {
		const availRequest = await getAvailabilityRequest(requestId);
		if (!availRequest || availRequest.groupId !== groupId) {
			throw new Response("Not Found", { status: 404 });
		}

		const admin = await isGroupAdmin(user.id, groupId);
		if (!admin && availRequest.createdById !== user.id) {
			throw new Response("Forbidden", { status: 403 });
		}

		await deleteAvailabilityRequest(requestId);
		return redirect(`/groups/${groupId}/availability`);
	}

	if (intent === "sendReminder") {
		const admin = await isGroupAdmin(user.id, groupId);
		if (!admin) throw new Response("Forbidden", { status: 403 });

		const rateLimit = checkReminderRateLimit(requestId);
		if (rateLimit.limited) {
			return {
				error: `Reminder already sent recently. Try again in ${rateLimit.retryAfter} seconds.`,
			};
		}

		const availRequest = await getAvailabilityRequest(requestId);
		if (!availRequest || availRequest.groupId !== groupId) {
			throw new Response("Not Found", { status: 404 });
		}

		if (availRequest.status !== "open") {
			return { error: "Cannot send reminders for a closed request." };
		}

		const nonRespondents = await getNonRespondents(requestId, groupId);
		if (nonRespondents.length === 0) {
			return { success: true, message: "Everyone has already responded!" };
		}

		const group = await getGroupById(groupId);
		const groupName = group?.name ?? "Your group";
		const appUrl = process.env.APP_URL || "https://mycalltime.app";
		const requestUrl = `${appUrl}/groups/${groupId}/availability/${requestId}`;
		const preferencesUrl = `${appUrl}/groups/${groupId}/notifications`;
		const dateRange = `${formatDateMedium(availRequest.dateRangeStart as unknown as string)} – ${formatDateMedium(availRequest.dateRangeEnd as unknown as string)}`;
		const expiresAt = availRequest.expiresAt
			? formatDateMedium(availRequest.expiresAt as unknown as string)
			: null;

		// Fire-and-forget: send email reminders
		void sendAvailabilityReminderNotification({
			requestTitle: availRequest.title,
			groupName,
			dateRange,
			expiresAt,
			recipients: nonRespondents.map((nr) => ({
				email: nr.email,
				name: nr.name,
				notificationPreferences: nr.notificationPreferences ?? undefined,
			})),
			requestUrl,
			preferencesUrl,
		});

		// Fire-and-forget: send Discord webhook if configured
		if (group?.webhookUrl) {
			sendAvailabilityReminderWebhook(group.webhookUrl, {
				groupName,
				title: availRequest.title,
				nonRespondentNames: nonRespondents.map((nr) => nr.name),
				requestUrl,
			});
		}

		// Track when reminder was sent
		await updateReminderSentAt(requestId);

		return {
			success: true,
			message: `Reminder sent to ${nonRespondents.length} member${nonRespondents.length !== 1 ? "s" : ""}!`,
		};
	}

	return { error: "Invalid action." };
}

export default function AvailabilityRequestDetail() {
	const { availRequest, userResponse, results, isAdmin, user, nonRespondentCount, reminderSentAt } =
		useLoaderData<typeof loader>();
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const timezone = parentData?.user?.timezone ?? undefined;
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const batchSuccess = searchParams.get("batchSuccess") === "true";
	const batchCount = searchParams.get("count");
	const isSubmitting = navigation.state === "submitting";
	const isSendingReminder = isSubmitting && navigation.formData?.get("intent") === "sendReminder";

	const dates = availRequest.requestedDates as string[];
	const [responses, setResponses] = useState<Record<string, AvailabilityStatus>>(
		(userResponse as Record<string, AvailabilityStatus>) ?? {},
	);
	const [view, setView] = useState<"respond" | "results">("respond");
	const isClosed = availRequest.status === "closed";
	const timeRange = formatTimeRange(availRequest.requestedStartTime, availRequest.requestedEndTime);
	const hasTimeRange = timeRange !== "All day";
	const canDelete = isAdmin || availRequest.createdById === user.id;
	const canEdit = isAdmin || availRequest.createdById === user.id;

	return (
		<div className="max-w-4xl">
			{/* Header */}
			<div className="mb-6">
				<Link
					to={`/groups/${availRequest.groupId}/availability`}
					className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Availability
				</Link>
				<div className="mt-2 flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<h2 className="text-2xl font-bold text-slate-900">{availRequest.title}</h2>
							{isClosed ? (
								<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
									<Lock className="h-3 w-3" /> Closed
								</span>
							) : (
								<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
									<LockOpen className="h-3 w-3" /> Open
								</span>
							)}
						</div>
						{availRequest.description && (
							<p className="mt-1 text-sm text-slate-600">{availRequest.description}</p>
						)}
						<div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
							<span>
								{formatDateMedium(availRequest.dateRangeStart as unknown as string, timezone)} –{" "}
								{formatDateMedium(availRequest.dateRangeEnd as unknown as string, timezone)}
							</span>
							{(availRequest.requestedStartTime || availRequest.requestedEndTime) && (
								<span className="inline-flex items-center gap-1">
									⏰{" "}
									{formatTimeRange(availRequest.requestedStartTime, availRequest.requestedEndTime)}
								</span>
							)}
							<span>Created by {availRequest.createdByName}</span>
							{availRequest.expiresAt && (
								<span className="inline-flex items-center gap-1">
									<Clock className="h-3 w-3" />
									Due {formatDateMedium(availRequest.expiresAt as unknown as string, timezone)}
								</span>
							)}
						</div>
					</div>
					<div className="flex items-center gap-2">
						{canEdit && (
							<Link
								to={`/groups/${availRequest.groupId}/availability/${availRequest.id}/edit`}
								className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
							>
								<Pencil className="h-3.5 w-3.5" /> Edit
							</Link>
						)}
						{isAdmin && (
							<Form method="post">
								<CsrfInput />
								<input type="hidden" name="intent" value={isClosed ? "reopen" : "close"} />
								<button
									type="submit"
									className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
										isClosed
											? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
											: "border-slate-300 text-slate-600 hover:bg-slate-50"
									}`}
								>
									{isClosed ? "Reopen Request" : "Close Request"}
								</button>
							</Form>
						)}
					</div>
				</div>
			</div>

			{/* Feedback */}
			{actionData && "message" in actionData && actionData.success && (
				<div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{actionData.message}
				</div>
			)}
			{actionData && "error" in actionData && (
				<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			{/* Batch creation success banner */}
			{batchSuccess && batchCount && (
				<div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-emerald-600" />
						<p className="text-sm font-medium text-emerald-700">
							Successfully created {batchCount} event{Number(batchCount) !== 1 ? "s" : ""}! Members
							have been notified.
						</p>
					</div>
					<Link
						to={`/groups/${availRequest.groupId}/events`}
						className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
					>
						View Events →
					</Link>
				</div>
			)}

			{/* Tab toggle for admins */}
			{isAdmin && results && (
				<div className="mb-6 flex gap-0 border-b border-slate-200">
					<button
						type="button"
						onClick={() => setView("respond")}
						className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
							view === "respond"
								? "border-emerald-600 text-emerald-600"
								: "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
						}`}
					>
						My Response
					</button>
					<button
						type="button"
						onClick={() => setView("results")}
						className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
							view === "results"
								? "border-emerald-600 text-emerald-600"
								: "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
						}`}
					>
						<Users className="h-4 w-4" />
						Results
					</button>
				</div>
			)}

			{/* Response Form */}
			{view === "respond" && (
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					{userResponse && (
						<p className="mb-4 text-xs text-slate-500">
							✅ You already responded. You can update your response below.
						</p>
					)}
					<AvailabilityGrid
						dates={dates}
						responses={responses}
						onChange={setResponses}
						disabled={isClosed}
						timeRange={hasTimeRange ? timeRange : null}
						timezone={timezone}
					/>
					{!isClosed && (
						<Form method="post" className="mt-6">
							<CsrfInput />
							<input type="hidden" name="intent" value="respond" />
							<input type="hidden" name="responses" value={JSON.stringify(responses)} />
							<button
								type="submit"
								disabled={isSubmitting || Object.keys(responses).length === 0}
								className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isSubmitting ? "Saving..." : userResponse ? "Update Response" : "Submit Response"}
							</button>
						</Form>
					)}
					{isClosed && (
						<p className="mt-4 text-sm text-slate-500">
							This request is closed. Responses are no longer being accepted.
						</p>
					)}
				</div>
			)}

			{/* Results View (admin only) */}
			{view === "results" && results && (
				<div className="space-y-6">
					<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 className="mb-4 text-lg font-semibold text-slate-900">Results</h3>
						<ResultsHeatmap
							dates={results.dates}
							totalMembers={results.totalMembers}
							totalResponded={results.totalResponded}
							groupId={availRequest.groupId}
							requestId={availRequest.id}
							timeRange={hasTimeRange ? timeRange : null}
							timezone={timezone}
							batchMode={isAdmin}
							onBatchCreate={(dates) => {
								navigate(
									`/groups/${availRequest.groupId}/availability/${availRequest.id}/batch?dates=${dates.join(",")}`,
								);
							}}
						/>
					</div>

					{/* Who hasn't responded */}
					{results.totalResponded < results.totalMembers && (
						<div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
							<p className="text-sm font-medium text-amber-800">
								Waiting for {results.totalMembers - results.totalResponded} more{" "}
								{results.totalMembers - results.totalResponded === 1 ? "response" : "responses"}
							</p>
							{!isClosed && (
								<Form method="post" className="mt-2">
									<CsrfInput />
									<input type="hidden" name="intent" value="sendReminder" />
									<button
										type="submit"
										disabled={isSendingReminder}
										className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
									>
										<Bell className="h-3.5 w-3.5" />
										{isSendingReminder
											? "Sending..."
											: `Send Reminder (${nonRespondentCount} haven't responded)`}
									</button>
								</Form>
							)}
							{reminderSentAt && (
								<p className="mt-2 text-xs text-amber-600">
									Last reminder sent{" "}
									{formatDateMedium(reminderSentAt as unknown as string, timezone)}
								</p>
							)}
						</div>
					)}
				</div>
			)}

			{/* Danger Zone — visible to admin or creator */}
			{canDelete && (
				<div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
					<h3 className="text-sm font-semibold text-red-900">Danger Zone</h3>
					<p className="mt-1 text-xs text-red-700">
						Deleting this request will remove all responses and cannot be undone.
					</p>
					<Form method="post" className="mt-4">
						<CsrfInput />
						<input type="hidden" name="intent" value="delete" />
						<button
							type="submit"
							onClick={(e) => {
								if (!confirm("Are you sure you want to delete this availability request?")) {
									e.preventDefault();
								}
							}}
							className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
						>
							<Trash2 className="h-4 w-4" /> Delete Request
						</button>
					</Form>
				</div>
			)}
		</div>
	);
}
