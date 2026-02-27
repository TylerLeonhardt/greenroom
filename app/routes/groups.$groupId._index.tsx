import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { CalendarDays } from "lucide-react";
import { EventCard } from "~/components/event-card";
import { getGroupEvents } from "~/services/events.server";
import {
	getGroupWithMembers,
	removeMember,
	requireGroupAdmin,
	requireGroupMember,
} from "~/services/groups.server";
import type { loader as groupLayoutLoader } from "./groups.$groupId";

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupMember(request, groupId);
	const data = await getGroupWithMembers(groupId);
	if (!data) throw new Response("Not Found", { status: 404 });
	const upcomingEvents = await getGroupEvents(groupId, { upcoming: true });
	return { members: data.members, upcomingEvents };
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupAdmin(request, groupId);

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "remove-member") {
		const userId = formData.get("userId");
		if (typeof userId !== "string") {
			return { error: "Invalid user." };
		}
		try {
			await removeMember(groupId, userId);
		} catch (error) {
			return { error: error instanceof Error ? error.message : "Failed to remove member." };
		}
	}

	return { success: true };
}

function UserAvatar({ name, profileImage }: { name: string; profileImage: string | null }) {
	if (profileImage) {
		return <img src={profileImage} alt={name} className="h-10 w-10 rounded-full object-cover" />;
	}
	const initials = name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	return (
		<div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-medium text-emerald-700">
			{initials}
		</div>
	);
}

export default function GroupOverview() {
	const { members, upcomingEvents } = useLoaderData<typeof loader>();
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const role = parentData?.role;
	const group = parentData?.group;
	const appUrl = typeof window !== "undefined" ? window.location.origin : "";
	const inviteLink = group ? `${appUrl}/groups/join?code=${group.inviteCode}` : "";

	return (
		<div className="grid gap-6 lg:grid-cols-3">
			{/* Main Content */}
			<div className="lg:col-span-2">
				{/* Member List */}
				<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
					<div className="border-b border-slate-100 px-6 py-4">
						<h2 className="text-lg font-semibold text-slate-900">Members ({members.length})</h2>
					</div>
					<ul className="divide-y divide-slate-100">
						{members.map((member) => (
							<li key={member.id} className="flex items-center justify-between px-6 py-4">
								<div className="flex items-center gap-3">
									<UserAvatar name={member.name} profileImage={member.profileImage} />
									<div>
										<p className="text-sm font-medium text-slate-900">{member.name}</p>
										<p className="text-xs text-slate-500">{member.email}</p>
									</div>
								</div>
								<div className="flex items-center gap-3">
									{member.role === "admin" ? (
										<span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
											Admin
										</span>
									) : (
										<span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
											Member
										</span>
									)}
									{role === "admin" && member.id !== parentData?.user.id && (
										<Form method="post">
											<input type="hidden" name="intent" value="remove-member" />
											<input type="hidden" name="userId" value={member.id} />
											<button
												type="submit"
												className="text-xs text-red-500 hover:text-red-700"
												onClick={(e) => {
													if (!confirm(`Remove ${member.name} from the group?`)) {
														e.preventDefault();
													}
												}}
											>
												Remove
											</button>
										</Form>
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>

			{/* Sidebar */}
			<div className="space-y-6">
				{/* Quick Stats */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="text-sm font-semibold text-slate-900">Quick Stats</h3>
					<dl className="mt-4 space-y-3">
						<div className="flex justify-between">
							<dt className="text-sm text-slate-500">Members</dt>
							<dd className="text-sm font-medium text-slate-900">{members.length}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-sm text-slate-500">Upcoming Events</dt>
							<dd className="text-sm font-medium text-slate-900">{upcomingEvents.length}</dd>
						</div>
						<div className="flex justify-between">
							<dt className="text-sm text-slate-500">Open Availability</dt>
							<dd className="text-sm font-medium text-slate-900">—</dd>
						</div>
					</dl>
				</div>

				{/* Upcoming Events Preview */}
				{upcomingEvents.length > 0 && (
					<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
						<div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
							<h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
								<CalendarDays className="h-4 w-4" /> Next Up
							</h3>
							<Link
								to={`/groups/${group?.id}/events`}
								className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
							>
								View all →
							</Link>
						</div>
						<div className="divide-y divide-slate-100 p-3">
							{upcomingEvents.slice(0, 3).map((event) => (
								<EventCard
									key={event.id}
									id={event.id}
									groupId={event.groupId}
									title={event.title}
									eventType={event.eventType}
									startTime={event.startTime as unknown as string}
									endTime={event.endTime as unknown as string}
									location={event.location}
									compact
								/>
							))}
						</div>
					</div>
				)}

				{/* Invite Code (admin only) */}
				{role === "admin" && group && (
					<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 className="text-sm font-semibold text-slate-900">Invite Code</h3>
						<div className="mt-3 flex items-center gap-2">
							<code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-center font-mono text-lg tracking-widest text-slate-900">
								{group.inviteCode}
							</code>
							<button
								type="button"
								onClick={() => navigator.clipboard.writeText(group.inviteCode)}
								className="rounded-lg border border-slate-300 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
								title="Copy invite code"
							>
								<svg
									className="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									strokeWidth={1.5}
									stroke="currentColor"
								>
									<title>Copy</title>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
									/>
								</svg>
							</button>
						</div>
						<button
							type="button"
							onClick={() => {
								navigator.clipboard.writeText(inviteLink);
							}}
							className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
						>
							📋 Copy Invite Link
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
