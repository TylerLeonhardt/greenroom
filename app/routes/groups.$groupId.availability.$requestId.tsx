import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
	useRouteLoaderData,
} from "@remix-run/react";
import { ArrowLeft, Clock, Lock, LockOpen, Users } from "lucide-react";
import { useState } from "react";
import { AvailabilityGrid } from "~/components/availability-grid";
import { CsrfInput } from "~/components/csrf-input";
import { ResultsHeatmap } from "~/components/results-heatmap";
import { formatDateMedium, formatTimeRange } from "~/lib/date-utils";
import {
	closeAvailabilityRequest,
	getAggregatedResults,
	getAvailabilityRequest,
	getUserResponse,
	reopenAvailabilityRequest,
	submitAvailabilityResponse,
} from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { isGroupAdmin, requireGroupMember } from "~/services/groups.server";
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

	return { availRequest, userResponse, results, isAdmin: admin, user };
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

	return { error: "Invalid action." };
}

export default function AvailabilityRequestDetail() {
	const { availRequest, userResponse, results, isAdmin } = useLoaderData<typeof loader>();
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const timezone = parentData?.user?.timezone ?? undefined;
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const dates = availRequest.requestedDates as string[];
	const [responses, setResponses] = useState<Record<string, AvailabilityStatus>>(
		(userResponse as Record<string, AvailabilityStatus>) ?? {},
	);
	const [view, setView] = useState<"respond" | "results">("respond");
	const isClosed = availRequest.status === "closed";
	const timeRange = formatTimeRange(availRequest.requestedStartTime, availRequest.requestedEndTime);
	const hasTimeRange = timeRange !== "All day";

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
						/>
					</div>

					{/* Who hasn't responded */}
					{results.totalResponded < results.totalMembers && (
						<div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
							<p className="text-sm font-medium text-amber-800">
								Waiting for {results.totalMembers - results.totalResponded} more{" "}
								{results.totalMembers - results.totalResponded === 1 ? "response" : "responses"}
							</p>
							<button
								type="button"
								disabled
								className="mt-2 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 opacity-50"
								title="Coming soon"
							>
								Send Reminder (coming soon)
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
