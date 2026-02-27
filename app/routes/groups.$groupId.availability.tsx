import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { Calendar, Users } from "lucide-react";
import { getGroupAvailabilityRequests } from "~/services/availability.server";
import { requireGroupMember } from "~/services/groups.server";
import type { loader as groupLayoutLoader } from "./groups.$groupId";

export const meta: MetaFunction = () => {
	return [{ title: "Availability — GreenRoom" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupMember(request, groupId);
	const requests = await getGroupAvailabilityRequests(groupId);
	return { requests };
}

function formatDateRange(start: string, end: string): string {
	const s = new Date(start);
	const e = new Date(end);
	const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
	const yearOpts: Intl.DateTimeFormatOptions = { ...opts, year: "numeric" };
	if (s.getFullYear() === e.getFullYear()) {
		return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", yearOpts)}`;
	}
	return `${s.toLocaleDateString("en-US", yearOpts)} – ${e.toLocaleDateString("en-US", yearOpts)}`;
}

export default function Availability() {
	const { requests } = useLoaderData<typeof loader>();
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const role = parentData?.role;
	const groupId = parentData?.group?.id;

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold text-slate-900">Availability Requests</h2>
					<p className="mt-1 text-sm text-slate-600">Manage scheduling polls for your group</p>
				</div>
				{role === "admin" && (
					<Link
						to={`/groups/${groupId}/availability/new`}
						className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
					>
						<Calendar className="h-4 w-4" />
						New Request
					</Link>
				)}
			</div>

			{requests.length === 0 ? (
				<div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
					<Calendar className="mx-auto h-12 w-12 text-slate-300" />
					<h3 className="mt-4 text-sm font-medium text-slate-900">No availability requests yet</h3>
					<p className="mt-1 text-sm text-slate-500">
						{role === "admin"
							? "Create one to find out when your group is free."
							: "Your group admin hasn't created any yet."}
					</p>
				</div>
			) : (
				<div className="mt-6 space-y-3">
					{requests.map((req) => {
						const progress =
							req.memberCount > 0 ? Math.round((req.responseCount / req.memberCount) * 100) : 0;
						return (
							<Link
								key={req.id}
								to={`/groups/${groupId}/availability/${req.id}`}
								className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<h3 className="text-base font-semibold text-slate-900 truncate">
												{req.title}
											</h3>
											{req.status === "open" ? (
												<span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
													Open
												</span>
											) : (
												<span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
													Closed
												</span>
											)}
										</div>
										<p className="mt-1 text-sm text-slate-500">
											{formatDateRange(
												req.dateRangeStart as unknown as string,
												req.dateRangeEnd as unknown as string,
											)}
										</p>
									</div>
								</div>
								<div className="mt-4 flex items-center gap-4">
									<div className="flex min-w-0 flex-1 items-center gap-2">
										<Users className="h-4 w-4 flex-shrink-0 text-slate-400" />
										<span className="text-xs text-slate-500">
											{req.responseCount}/{req.memberCount} responded
										</span>
										<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
											<div
												className="h-full rounded-full bg-emerald-500 transition-all"
												style={{ width: `${progress}%` }}
											/>
										</div>
									</div>
									<span className="flex-shrink-0 text-xs text-slate-400">
										by {req.createdByName}
									</span>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
