import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Plus } from "lucide-react";
import { getGroupById, getUserRole, requireGroupMember } from "~/services/groups.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [{ title: data ? `${data.group.name} — My Call Time` : "Group — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupMember(request, groupId);
	const group = await getGroupById(groupId);
	if (!group) throw new Response("Not Found", { status: 404 });
	const role = await getUserRole(user.id, groupId);
	return { group, user, role };
}

function TabLink({
	to,
	active,
	children,
}: {
	to: string;
	active: boolean;
	children: React.ReactNode;
}) {
	return (
		<Link
			to={to}
			className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
				active
					? "border-emerald-600 text-emerald-600"
					: "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
			}`}
		>
			{children}
		</Link>
	);
}

export default function GroupLayout() {
	const { group, role } = useLoaderData<typeof loader>();
	const location = useLocation();
	const basePath = `/groups/${group.id}`;
	const canCreate =
		role === "admin" || group.membersCanCreateRequests || group.membersCanCreateEvents;
	const isCreate = location.pathname === `${basePath}/create`;

	const isOverview = location.pathname === basePath || location.pathname === `${basePath}/`;
	const isAvailability = location.pathname.startsWith(`${basePath}/availability`);
	const isEvents = location.pathname.startsWith(`${basePath}/events`);
	const isNotifications = location.pathname.startsWith(`${basePath}/notifications`);
	const isSettings = location.pathname.startsWith(`${basePath}/settings`);

	return (
		<div>
			<div className="mb-6 flex items-start justify-between gap-4">
				<div>
					<Link to="/groups" className="text-sm text-slate-500 hover:text-slate-700">
						← Back to Groups
					</Link>
					<h1 className="mt-2 text-3xl font-bold text-slate-900">{group.name}</h1>
					{group.description && <p className="mt-1 text-slate-600">{group.description}</p>}
				</div>
				{canCreate && !isCreate && (
					<Link
						to={`${basePath}/create`}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2"
					>
						<Plus className="h-4 w-4" aria-hidden="true" />
						Create
					</Link>
				)}
			</div>

			<div className="mb-6 flex gap-0 overflow-x-auto border-b border-slate-200">
				<TabLink to={basePath} active={isOverview}>
					Overview
				</TabLink>
				<TabLink to={`${basePath}/availability`} active={isAvailability}>
					Availability
				</TabLink>
				<TabLink to={`${basePath}/events`} active={isEvents}>
					Events
				</TabLink>
				<TabLink to={`${basePath}/notifications`} active={isNotifications}>
					Notifications
				</TabLink>
				{role === "admin" && (
					<TabLink to={`${basePath}/settings`} active={isSettings}>
						Settings
					</TabLink>
				)}
			</div>

			<Outlet />
		</div>
	);
}
