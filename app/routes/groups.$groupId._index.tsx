import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { CalendarDays } from "lucide-react";
import { CopyButton, CopyIconButton } from "~/components/copy-button";
import { CsrfInput } from "~/components/csrf-input";
import { EventCard } from "~/components/event-card";
import { getOpenAvailabilityRequestCount } from "~/services/availability.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { getGroupEvents } from "~/services/events.server";
import {
	getGroupWithMembers,
	removeMember,
	requireGroupAdmin,
	requireGroupMember,
} from "~/services/groups.server";
import { logger } from "~/services/logger.server";
import type { loader as groupLayoutLoader } from "./groups.$groupId";

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupMember(request, groupId);
	const data = await getGroupWithMembers(groupId);
	if (!data) throw new Response("Not Found", { status: 404 });
	const [upcomingEvents, openAvailabilityCount] = await Promise.all([
		getGroupEvents(groupId, { upcoming: true }),
		getOpenAvailabilityRequestCount(groupId),
	]);
	return { members: data.members, upcomingEvents, openAvailabilityCount };
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupAdmin(request, groupId);

	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	if (intent === "remove-member") {
		const userId = formData.get("userId");
		if (typeof userId !== "string" || !userId.trim()) {
			return { error: "Invalid user." };
		}
		try {
			await removeMember(groupId, userId);
		} catch (error) {
			logger.error({ err: error, route: "groups.$groupId._index" }, "Failed to remove member");
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
	const { members, upcomingEvents, openAvailabilityCount } = useLoaderData<typeof loader>();
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const role = parentData?.role;
	const group = parentData?.group;
	const timezone = parentData?.user?.timezone ?? undefined;
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
											<CsrfInput />
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
							<dd className="text-sm font-medium text-slate-900">{openAvailabilityCount}</dd>
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
									timezone={timezone}
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
							<CopyIconButton value={group.inviteCode} title="Copy invite code" />
						</div>
						<CopyButton value={inviteLink} className="mt-3 w-full px-3 py-2 text-sm font-medium">
							📋 Copy Invite Link
						</CopyButton>
					</div>
				)}
			</div>
		</div>
	);
}
