import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { requireUser } from "~/services/auth.server";
import { createGroup, getUserGroups, joinGroup } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Groups — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await requireUser(request);
	const groups = await getUserGroups(user.id);
	return { groups };
}

export async function action({ request }: ActionFunctionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "create") {
		const name = formData.get("name");
		if (typeof name !== "string" || !name.trim()) {
			return { error: "Group name is required.", intent: "create" };
		}
		const description = formData.get("description");
		const group = await createGroup(user.id, {
			name,
			description: typeof description === "string" ? description : undefined,
		});
		return redirect(`/groups/${group.id}`);
	}

	if (intent === "join") {
		const code = formData.get("code");
		if (typeof code !== "string" || !code.trim()) {
			return { error: "Invite code is required.", intent: "join" };
		}
		const result = await joinGroup(user.id, code);
		if (!result.success) {
			return { error: result.error, intent: "join" };
		}
		return redirect(`/groups/${result.groupId}`);
	}

	return { error: "Invalid action.", intent: "" };
}

function RoleBadge({ role }: { role: string }) {
	return role === "admin" ? (
		<span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
			Admin
		</span>
	) : (
		<span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
			Member
		</span>
	);
}

export default function Groups() {
	const { groups } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">Your Groups</h1>
					<p className="mt-2 text-slate-600">Manage your improv groups</p>
				</div>
				<div className="flex gap-3">
					<Link
						to="/groups/new"
						className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
					>
						Create Group
					</Link>
				</div>
			</div>

			{/* Join Group Section */}
			<div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
				<Form method="post" className="flex items-end gap-3">
					<input type="hidden" name="intent" value="join" />
					<div className="flex-1">
						<label htmlFor="join-code" className="block text-sm font-medium text-slate-700">
							Have an invite code?
						</label>
						<input
							id="join-code"
							name="code"
							type="text"
							placeholder="Enter invite code"
							className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
						/>
					</div>
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
					>
						{isSubmitting ? "Joining…" : "Join Group"}
					</button>
				</Form>
				{actionData?.intent === "join" && actionData.error && (
					<p className="mt-2 text-sm text-red-600">{actionData.error}</p>
				)}
			</div>

			{/* Groups Grid */}
			{groups.length === 0 ? (
				<div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
					<div className="text-4xl">🎭</div>
					<h3 className="mt-4 text-lg font-semibold text-slate-900">No groups yet</h3>
					<p className="mt-2 max-w-sm text-sm text-slate-500">
						You&apos;re not in any groups yet. Create one or join with an invite code to get
						started.
					</p>
					<Link
						to="/groups/new"
						className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
					>
						Create Your First Group
					</Link>
				</div>
			) : (
				<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{groups.map((group) => (
						<Link
							key={group.id}
							to={`/groups/${group.id}`}
							className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
						>
							<div className="flex items-start justify-between">
								<h3 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-600">
									{group.name}
								</h3>
								<RoleBadge role={group.role} />
							</div>
							{group.description && (
								<p className="mt-2 line-clamp-2 text-sm text-slate-500">{group.description}</p>
							)}
							<div className="mt-4 flex items-center gap-1 text-sm text-slate-400">
								<svg
									className="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									strokeWidth={1.5}
									stroke="currentColor"
								>
									<title>Members</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
									/>
								</svg>
								<span>
									{group.memberCount} {group.memberCount === 1 ? "member" : "members"}
								</span>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
