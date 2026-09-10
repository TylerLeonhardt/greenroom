import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useRouteLoaderData } from "@remix-run/react";
import { ArrowRight, CalendarCheck2, CalendarRange } from "lucide-react";
import { requireGroupMember } from "~/services/groups.server";
import type { loader as groupLayoutLoader } from "./groups.$groupId";

export const meta: MetaFunction = () => {
	return [{ title: "Create — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupMember(request, groupId);
	return null;
}

export default function CreateChooser() {
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const group = parentData?.group;
	const role = parentData?.role;
	const canCreateRequests = role === "admin" || group?.membersCanCreateRequests === true;
	const canCreateEvents = role === "admin" || group?.membersCanCreateEvents === true;
	const basePath = `/groups/${group?.id ?? ""}`;

	return (
		<div className="mx-auto max-w-4xl">
			<div className="text-center">
				<h2 className="text-2xl font-bold text-slate-900">What would you like to create?</h2>
				<p className="mt-2 text-sm text-slate-600">
					Choose based on whether your plans are still taking shape or already settled.
				</p>
			</div>

			<div className="mt-8 grid gap-5 md:grid-cols-2">
				<article
					aria-labelledby="availability-request-option"
					className="flex flex-col rounded-xl border border-emerald-200 bg-white p-6 shadow-sm"
				>
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
						<CalendarRange className="h-6 w-6 text-emerald-700" aria-hidden="true" />
					</div>
					<h3 id="availability-request-option" className="mt-5 text-xl font-bold text-slate-900">
						Availability Request
					</h3>
					<p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
						Not sure when it will happen? Gauge interest and find a date that works for your
						performers.
					</p>
					{canCreateRequests ? (
						<Link
							to={`${basePath}/availability/new`}
							className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2"
						>
							Create availability request
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
					) : (
						<p className="mt-6 rounded-lg bg-slate-100 px-4 py-2.5 text-center text-sm text-slate-600">
							Only group admins can create availability requests.
						</p>
					)}
				</article>

				<article
					aria-labelledby="event-option"
					className="flex flex-col rounded-xl border border-purple-200 bg-white p-6 shadow-sm"
				>
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
						<CalendarCheck2 className="h-6 w-6 text-purple-700" aria-hidden="true" />
					</div>
					<h3 id="event-option" className="mt-5 text-xl font-bold text-slate-900">
						Event
					</h3>
					<p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
						Know the date and lineup? Create a scheduled event for a concrete set of performers.
					</p>
					{canCreateEvents ? (
						<Link
							to={`${basePath}/events/new`}
							className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:ring-offset-2"
						>
							Create event
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
					) : (
						<p className="mt-6 rounded-lg bg-slate-100 px-4 py-2.5 text-center text-sm text-slate-600">
							Only group admins can create events.
						</p>
					)}
				</article>
			</div>
		</div>
	);
}
