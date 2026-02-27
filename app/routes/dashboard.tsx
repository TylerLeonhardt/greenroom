import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUser } from "~/services/auth.server";

export const meta: MetaFunction = () => {
	return [{ title: "Dashboard — GreenRoom" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await requireUser(request);
	return { user };
}

export default function Dashboard() {
	const { user } = useLoaderData<typeof loader>();

	return (
		<div>
			<h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.name}!</h1>
			<p className="mt-2 text-slate-600">Here&apos;s what&apos;s happening with your groups.</p>

			<div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Your Groups</h2>
					<p className="mt-2 text-sm text-slate-500">
						Your groups will appear here once you join or create one.
					</p>
				</div>

				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Upcoming Events</h2>
					<p className="mt-2 text-sm text-slate-500">
						Upcoming rehearsals and shows will appear here.
					</p>
				</div>

				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-900">Pending Requests</h2>
					<p className="mt-2 text-sm text-slate-500">
						Availability requests needing your response will appear here.
					</p>
				</div>
			</div>
		</div>
	);
}
