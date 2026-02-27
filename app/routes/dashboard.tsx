import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/services/auth.server";
import { getUserGroups } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Dashboard — GreenRoom" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await requireUser(request);
	const groups = await getUserGroups(user.id);
	return { user, groups };
}

export default function Dashboard() {
	const { user, groups } = useLoaderData<typeof loader>();
	const displayGroups = groups.slice(0, 4);

	return (
		<div>
			<h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.name}!</h1>
			<p className="mt-2 text-slate-600">Here&apos;s what&apos;s happening with your groups.</p>

			{/* Groups Section */}
			<div className="mt-8">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold text-slate-900">Your Groups</h2>
					{groups.length > 4 && (
						<Link
							to="/groups"
							className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
						>
							View all groups →
						</Link>
					)}
				</div>

				{groups.length === 0 ? (
					<div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
						<div className="text-3xl">🎭</div>
						<h3 className="mt-3 text-base font-semibold text-slate-900">Create your first group</h3>
						<p className="mt-1 max-w-sm text-sm text-slate-500">
							Get your ensemble together by creating a group or joining one with an invite code.
						</p>
						<div className="mt-4 flex gap-3">
							<Link
								to="/groups/new"
								className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
							>
								Create Group
							</Link>
							<Link
								to="/groups/join"
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
							>
								Join Group
							</Link>
						</div>
					</div>
				) : (
					<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{displayGroups.map((group) => (
							<Link
								key={group.id}
								to={`/groups/${group.id}`}
								className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
							>
								<h3 className="text-base font-semibold text-slate-900 group-hover:text-emerald-600">
									{group.name}
								</h3>
								<div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
									<span>
										{group.memberCount} {group.memberCount === 1 ? "member" : "members"}
									</span>
									<span>·</span>
									<span className="capitalize">{group.role}</span>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>

			<div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
