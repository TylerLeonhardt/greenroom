import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
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
			className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
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

	const isOverview = location.pathname === basePath || location.pathname === `${basePath}/`;
	const isAvailability = location.pathname.startsWith(`${basePath}/availability`);
	const isEvents = location.pathname.startsWith(`${basePath}/events`);
	const isNotifications = location.pathname.startsWith(`${basePath}/notifications`);
	const isSettings = location.pathname.startsWith(`${basePath}/settings`);

	return (
		<div>
			<div className="mb-6">
				<Link to="/groups" className="text-sm text-slate-500 hover:text-slate-700">
					← Back to Groups
				</Link>
				<h1 className="mt-2 text-3xl font-bold text-slate-900">{group.name}</h1>
				{group.description && <p className="mt-1 text-slate-600">{group.description}</p>}
			</div>

			<div className="mb-6 flex gap-0 border-b border-slate-200">
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
