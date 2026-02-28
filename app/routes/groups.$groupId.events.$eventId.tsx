import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
	useParams,
	useRouteLoaderData,
} from "@remix-run/react";
import {
	ArrowLeft,
	Calendar,
	CalendarDays,
	Check,
	Clock,
	Download,
	Eye,
	MapPin,
	Pencil,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { formatDateLong, formatTime } from "~/lib/date-utils";
import {
	assignToEvent,
	bulkAssignToEvent,
	getAvailabilityForEventDate,
	getAvailabilityRequestGroupId,
	getEventWithAssignments,
	removeAssignment,
	updateAssignmentStatus,
} from "~/services/events.server";
import { getGroupWithMembers, isGroupAdmin, requireGroupMember } from "~/services/groups.server";
import type { loader as groupLayoutLoader } from "./groups.$groupId";

export const meta: MetaFunction = () => {
	return [{ title: "Event Detail — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const eventId = params.eventId ?? "";
	const user = await requireGroupMember(request, groupId);
	const admin = await isGroupAdmin(user.id, groupId);

	const data = await getEventWithAssignments(eventId);
	if (!data || data.event.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	let members: Array<{
		id: string;
		name: string;
		email: string;
		profileImage: string | null;
		role: string;
	}> = [];
	let availabilityData: Array<{ userId: string; userName: string; status: string }> = [];
	if (admin) {
		const groupData = await getGroupWithMembers(groupId);
		members = groupData?.members ?? [];

		if (data.event.createdFromRequestId) {
			// Verify the availability request belongs to this group before exposing its data
			const requestGroupId = await getAvailabilityRequestGroupId(data.event.createdFromRequestId);
			if (requestGroupId === groupId) {
				const eventDate = new Date(data.event.startTime);
				const dateKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, "0")}-${String(eventDate.getDate()).padStart(2, "0")}`;
				availabilityData = await getAvailabilityForEventDate(
					data.event.createdFromRequestId,
					dateKey,
				);
			}
		}
	}

	return {
		event: data.event,
		assignments: data.assignments,
		isAdmin: admin,
		userId: user.id,
		members,
		availabilityData,
	};
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const eventId = params.eventId ?? "";
	const user = await requireGroupMember(request, groupId);

	// Verify the event belongs to this group before any mutation
	const eventData = await getEventWithAssignments(eventId);
	if (!eventData || eventData.event.groupId !== groupId) {
		throw new Response("Not Found", { status: 404 });
	}

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "confirm" || intent === "decline") {
		await updateAssignmentStatus(eventId, user.id, intent === "confirm" ? "confirmed" : "declined");
		return { success: true };
	}

	if (intent === "attend") {
		// Self-register as viewer
		await assignToEvent(eventId, user.id, "Viewer");
		await updateAssignmentStatus(eventId, user.id, "confirmed");
		return { success: true };
	}

	// Admin-only actions
	const admin = await isGroupAdmin(user.id, groupId);
	if (!admin) throw new Response("Forbidden", { status: 403 });

	if (intent === "assign") {
		const userIds = formData.getAll("userIds");
		const role = formData.get("role");
		const validIds = userIds.filter((id): id is string => typeof id === "string" && id.length > 0);
		if (validIds.length > 0) {
			// Verify all provided userIds are actual members of this group
			const groupData = await getGroupWithMembers(groupId);
			const memberIds = new Set(groupData?.members.map((m) => m.id) ?? []);
			const verifiedIds = validIds.filter((id) => memberIds.has(id));
			if (verifiedIds.length === 0) {
				return { error: "None of the specified users are members of this group." };
			}
			await bulkAssignToEvent(
				eventId,
				verifiedIds,
				typeof role === "string" && role ? role : undefined,
			);
		}
		return { success: true };
	}

	if (intent === "remove-assignment") {
		const userId = formData.get("userId");
		if (typeof userId === "string") {
			await removeAssignment(eventId, userId);
		}
		return { success: true };
	}

	return { error: "Invalid action." };
}

const EVENT_TYPE_CONFIG: Record<string, { emoji: string; label: string; badgeClass: string }> = {
	show: { emoji: "🎭", label: "Show", badgeClass: "bg-purple-100 text-purple-700" },
	rehearsal: { emoji: "🎯", label: "Rehearsal", badgeClass: "bg-emerald-100 text-emerald-700" },
	other: { emoji: "📅", label: "Other", badgeClass: "bg-slate-100 text-slate-700" },
};

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
	confirmed: { label: "Confirmed", badgeClass: "bg-emerald-100 text-emerald-700" },
	declined: { label: "Declined", badgeClass: "bg-red-100 text-red-700" },
	pending: { label: "Pending", badgeClass: "bg-amber-100 text-amber-700" },
};

export default function EventDetail() {
	const { event, assignments, isAdmin, userId, members, availabilityData } =
		useLoaderData<typeof loader>();
	const { groupId } = useParams();
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const timezone = parentData?.user?.timezone ?? undefined;
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const [showAddMembers, setShowAddMembers] = useState(false);
	const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
	const [assignRole, setAssignRole] = useState("");

	const typeConfig = EVENT_TYPE_CONFIG[event.eventType] ?? EVENT_TYPE_CONFIG.other;
	const myAssignment = assignments.find((a) => a.userId === userId);
	const assignedUserIds = new Set(assignments.map((a) => a.userId));
	const unassignedMembers = members.filter((m) => !assignedUserIds.has(m.id));

	const isShow = event.eventType === "show";
	const performers = isShow ? assignments.filter((a) => a.role === "Performer") : [];
	const viewers = isShow ? assignments.filter((a) => a.role === "Viewer") : [];
	const otherAssignments = isShow
		? assignments.filter((a) => a.role !== "Performer" && a.role !== "Viewer")
		: assignments;
	const canSelfRegister = !myAssignment && !isAdmin;

	const dateStr = formatDateLong(event.startTime, timezone);
	const startTimeStr = formatTime(event.startTime, timezone);
	const endTimeStr = formatTime(event.endTime, timezone);
	const callTimeStr = event.callTime
		? formatTime(event.callTime as unknown as string, timezone)
		: null;

	const toggleUser = (id: string) => {
		const next = new Set(selectedUserIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedUserIds(next);
	};

	// Pre-sort availability data for suggestions
	const availableUsers = availabilityData.filter(
		(a) => a.status === "available" && !assignedUserIds.has(a.userId),
	);
	const maybeUsers = availabilityData.filter(
		(a) => a.status === "maybe" && !assignedUserIds.has(a.userId),
	);
	const unavailableUsers = availabilityData.filter(
		(a) => a.status === "not_available" && !assignedUserIds.has(a.userId),
	);
	const hasAvailData = availabilityData.length > 0;

	const isMyPerformer = myAssignment?.role === "Performer";

	return (
		<div className="max-w-4xl">
			{/* Header */}
			<div className="mb-6">
				<Link
					to={`/groups/${groupId}/events`}
					className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Events
				</Link>
				<div className="mt-2 flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<span
								className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeConfig.badgeClass}`}
							>
								{typeConfig.emoji} {typeConfig.label}
							</span>
						</div>
						<h2 className="mt-1 text-2xl font-bold text-slate-900">{event.title}</h2>
					</div>
					<div className="flex items-center gap-2">
						<a
							href={`/api/events/${event.id}/ics${isMyPerformer ? "?role=Performer" : ""}`}
							className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
							download
						>
							<Download className="h-3.5 w-3.5" /> Add to Calendar
						</a>
						{isAdmin && (
							<Link
								to={`/groups/${groupId}/events/${event.id}/edit`}
								className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
							>
								<Pencil className="h-3.5 w-3.5" /> Edit
							</Link>
						)}
					</div>
				</div>
			</div>

			{/* Feedback */}
			{actionData && "success" in actionData && actionData.success && (
				<div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					Updated successfully!
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Main Info */}
				<div className="space-y-6 lg:col-span-2">
					{/* Details Card */}
					<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<div className="space-y-3">
							<div className="flex items-center gap-2 text-sm text-slate-700">
								<CalendarDays className="h-4 w-4 text-slate-400" />
								{dateStr}
							</div>
							<div className="flex items-center gap-2 text-sm text-slate-700">
								<Clock className="h-4 w-4 text-slate-400" />
								{startTimeStr} – {endTimeStr}
							</div>
							{isShow && callTimeStr && (
								<div className="flex items-center gap-2 text-sm text-purple-700">
									<Clock className="h-4 w-4 text-purple-400" />
									Call Time: {callTimeStr}
									<span className="text-xs text-purple-500">(performers arrive)</span>
								</div>
							)}
							{event.location && (
								<div className="flex items-center gap-2 text-sm text-slate-700">
									<MapPin className="h-4 w-4 text-slate-400" />
									{event.location}
								</div>
							)}
						</div>
						{event.description && (
							<div className="mt-4 border-t border-slate-100 pt-4">
								<p className="text-sm text-slate-600">{event.description}</p>
							</div>
						)}
						{event.createdFromRequestId && (
							<div className="mt-4 border-t border-slate-100 pt-4">
								<Link
									to={`/groups/${groupId}/availability/${event.createdFromRequestId}`}
									className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
								>
									View availability request →
								</Link>
							</div>
						)}
						<div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-400">
							Created by {event.createdByName}
						</div>
					</div>

					{/* Show: Cast (Performers) */}
					{isShow && (
						<div className="rounded-xl border border-purple-200 bg-white shadow-sm">
							<div className="flex items-center justify-between border-b border-purple-100 px-6 py-4">
								<h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
									<Users className="h-5 w-5 text-purple-500" /> Cast ({performers.length})
								</h3>
								{isAdmin && unassignedMembers.length > 0 && (
									<button
										type="button"
										onClick={() => setShowAddMembers(!showAddMembers)}
										className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-50"
									>
										<UserPlus className="h-3.5 w-3.5" />
										{showAddMembers ? "Cancel" : "Add Performers"}
									</button>
								)}
							</div>

							{performers.length === 0 ? (
								<div className="p-6 text-center text-sm text-slate-500">
									No performers assigned yet.{" "}
									{isAdmin && (
										<button
											type="button"
											onClick={() => setShowAddMembers(true)}
											className="font-medium text-purple-600 hover:text-purple-700"
										>
											Add performers
										</button>
									)}
								</div>
							) : (
								<ul className="divide-y divide-purple-50">
									{performers.map((a) => {
										const statusCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
										return (
											<li key={a.userId} className="flex items-center justify-between px-6 py-3">
												<div>
													<span className="text-sm font-medium text-slate-900">{a.userName}</span>
													<span className="ml-2 text-xs text-purple-500">Performer</span>
												</div>
												<div className="flex items-center gap-2">
													<span
														className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.badgeClass}`}
													>
														{statusCfg.label}
													</span>
													{isAdmin && (
														<Form method="post">
															<input type="hidden" name="intent" value="remove-assignment" />
															<input type="hidden" name="userId" value={a.userId} />
															<button
																type="submit"
																className="text-slate-400 transition-colors hover:text-red-500"
																title="Remove"
															>
																<X className="h-4 w-4" />
															</button>
														</Form>
													)}
												</div>
											</li>
										);
									})}
								</ul>
							)}

							{/* Add Members Panel */}
							{showAddMembers && isAdmin && (
								<div className="border-t border-purple-200 bg-purple-50/50 p-6">
									<Form
										method="post"
										onSubmit={() => {
											setShowAddMembers(false);
											setSelectedUserIds(new Set());
										}}
									>
										<input type="hidden" name="intent" value="assign" />
										<input type="hidden" name="role" value="Performer" />
										{Array.from(selectedUserIds).map((id) => (
											<input key={id} type="hidden" name="userIds" value={id} />
										))}

										{/* Availability suggestions */}
										{hasAvailData && (
											<div className="mb-4 space-y-3">
												{availableUsers.length > 0 && (
													<div>
														<h4 className="mb-1.5 text-xs font-semibold text-emerald-700">
															✅ Available
														</h4>
														<div className="flex flex-wrap gap-2">
															{availableUsers.map((u) => (
																<label
																	key={u.userId}
																	className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
																		selectedUserIds.has(u.userId)
																			? "border-emerald-400 bg-emerald-100 text-emerald-800"
																			: "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
																	}`}
																>
																	<input
																		type="checkbox"
																		className="sr-only"
																		checked={selectedUserIds.has(u.userId)}
																		onChange={() => toggleUser(u.userId)}
																	/>
																	{u.userName}
																</label>
															))}
														</div>
													</div>
												)}
												{maybeUsers.length > 0 && (
													<div>
														<h4 className="mb-1.5 text-xs font-semibold text-amber-700">
															🤔 Maybe
														</h4>
														<div className="flex flex-wrap gap-2">
															{maybeUsers.map((u) => (
																<label
																	key={u.userId}
																	className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
																		selectedUserIds.has(u.userId)
																			? "border-amber-400 bg-amber-100 text-amber-800"
																			: "border-slate-200 bg-white text-slate-700 hover:bg-amber-50"
																	}`}
																>
																	<input
																		type="checkbox"
																		className="sr-only"
																		checked={selectedUserIds.has(u.userId)}
																		onChange={() => toggleUser(u.userId)}
																	/>
																	{u.userName}
																</label>
															))}
														</div>
													</div>
												)}
												{unavailableUsers.length > 0 && (
													<div>
														<h4 className="mb-1.5 text-xs font-semibold text-slate-500">
															❌ Not Available
														</h4>
														<div className="flex flex-wrap gap-2">
															{unavailableUsers.map((u) => (
																<label
																	key={u.userId}
																	className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium opacity-60 transition-colors ${
																		selectedUserIds.has(u.userId)
																			? "border-red-400 bg-red-100 text-red-800"
																			: "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
																	}`}
																>
																	<input
																		type="checkbox"
																		className="sr-only"
																		checked={selectedUserIds.has(u.userId)}
																		onChange={() => toggleUser(u.userId)}
																	/>
																	{u.userName}
																</label>
															))}
														</div>
													</div>
												)}
											</div>
										)}

										{/* Non-availability members */}
										{!hasAvailData && unassignedMembers.length > 0 && (
											<div className="mb-4">
												<h4 className="mb-2 text-xs font-semibold text-slate-700">
													Select Performers
												</h4>
												<div className="flex flex-wrap gap-2">
													{unassignedMembers.map((m) => (
														<label
															key={m.id}
															className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
																selectedUserIds.has(m.id)
																	? "border-purple-400 bg-purple-100 text-purple-800"
																	: "border-slate-200 bg-white text-slate-700 hover:bg-purple-50"
															}`}
														>
															<input
																type="checkbox"
																className="sr-only"
																checked={selectedUserIds.has(m.id)}
																onChange={() => toggleUser(m.id)}
															/>
															{m.name}
														</label>
													))}
												</div>
											</div>
										)}

										<button
											type="submit"
											disabled={isSubmitting || selectedUserIds.size === 0}
											className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{isSubmitting
												? "Adding..."
												: `Add ${selectedUserIds.size} Performer${selectedUserIds.size !== 1 ? "s" : ""}`}
										</button>
									</Form>
								</div>
							)}
						</div>
					)}

					{/* Show: Attending (Viewers) */}
					{isShow && (
						<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
							<div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
								<h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
									<Eye className="h-5 w-5 text-slate-400" /> Attending ({viewers.length})
								</h3>
							</div>
							{viewers.length === 0 && !canSelfRegister ? (
								<div className="p-6 text-center text-sm text-slate-500">No viewers yet.</div>
							) : (
								<>
									{viewers.length > 0 && (
										<ul className="divide-y divide-slate-100">
											{viewers.map((a) => {
												const statusCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
												return (
													<li
														key={a.userId}
														className="flex items-center justify-between px-6 py-3"
													>
														<span className="text-sm font-medium text-slate-900">{a.userName}</span>
														<div className="flex items-center gap-2">
															<span
																className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.badgeClass}`}
															>
																{statusCfg.label}
															</span>
															{isAdmin && (
																<Form method="post">
																	<input type="hidden" name="intent" value="remove-assignment" />
																	<input type="hidden" name="userId" value={a.userId} />
																	<button
																		type="submit"
																		className="text-slate-400 transition-colors hover:text-red-500"
																		title="Remove"
																	>
																		<X className="h-4 w-4" />
																	</button>
																</Form>
															)}
														</div>
													</li>
												);
											})}
										</ul>
									)}
									{canSelfRegister && (
										<div className="border-t border-slate-100 p-4">
											<Form method="post">
												<input type="hidden" name="intent" value="attend" />
												<button
													type="submit"
													disabled={isSubmitting}
													className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
												>
													<Calendar className="h-4 w-4" /> I'll be there
												</button>
											</Form>
										</div>
									)}
								</>
							)}
						</div>
					)}

					{/* Non-show: Generic Cast List */}
					{!isShow && (
						<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
							<div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
								<h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
									<Users className="h-5 w-5" /> Cast ({assignments.length})
								</h3>
								{isAdmin && unassignedMembers.length > 0 && (
									<button
										type="button"
										onClick={() => setShowAddMembers(!showAddMembers)}
										className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
									>
										<UserPlus className="h-3.5 w-3.5" />
										{showAddMembers ? "Cancel" : "Add Members"}
									</button>
								)}
							</div>

							{assignments.length === 0 ? (
								<div className="p-6 text-center text-sm text-slate-500">
									No one assigned yet.{" "}
									{isAdmin && (
										<button
											type="button"
											onClick={() => setShowAddMembers(true)}
											className="font-medium text-emerald-600 hover:text-emerald-700"
										>
											Add members
										</button>
									)}
								</div>
							) : (
								<ul className="divide-y divide-slate-100">
									{assignments.map((a) => {
										const statusCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
										return (
											<li key={a.userId} className="flex items-center justify-between px-6 py-3">
												<div>
													<span className="text-sm font-medium text-slate-900">{a.userName}</span>
													{a.role && <span className="ml-2 text-xs text-slate-500">{a.role}</span>}
												</div>
												<div className="flex items-center gap-2">
													<span
														className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.badgeClass}`}
													>
														{statusCfg.label}
													</span>
													{isAdmin && (
														<Form method="post">
															<input type="hidden" name="intent" value="remove-assignment" />
															<input type="hidden" name="userId" value={a.userId} />
															<button
																type="submit"
																className="text-slate-400 transition-colors hover:text-red-500"
																title="Remove"
															>
																<X className="h-4 w-4" />
															</button>
														</Form>
													)}
												</div>
											</li>
										);
									})}
								</ul>
							)}

							{/* Add Members Panel (non-show) */}
							{showAddMembers && isAdmin && (
								<div className="border-t border-slate-200 bg-slate-50 p-6">
									<Form
										method="post"
										onSubmit={() => {
											setShowAddMembers(false);
											setSelectedUserIds(new Set());
										}}
									>
										<input type="hidden" name="intent" value="assign" />
										{Array.from(selectedUserIds).map((id) => (
											<input key={id} type="hidden" name="userIds" value={id} />
										))}

										{/* Availability suggestions */}
										{hasAvailData && (
											<div className="mb-4 space-y-3">
												{availableUsers.length > 0 && (
													<div>
														<h4 className="mb-1.5 text-xs font-semibold text-emerald-700">
															✅ Available
														</h4>
														<div className="flex flex-wrap gap-2">
															{availableUsers.map((u) => (
																<label
																	key={u.userId}
																	className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
																		selectedUserIds.has(u.userId)
																			? "border-emerald-400 bg-emerald-100 text-emerald-800"
																			: "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
																	}`}
																>
																	<input
																		type="checkbox"
																		className="sr-only"
																		checked={selectedUserIds.has(u.userId)}
																		onChange={() => toggleUser(u.userId)}
																	/>
																	{u.userName}
																</label>
															))}
														</div>
													</div>
												)}
												{maybeUsers.length > 0 && (
													<div>
														<h4 className="mb-1.5 text-xs font-semibold text-amber-700">
															🤔 Maybe
														</h4>
														<div className="flex flex-wrap gap-2">
															{maybeUsers.map((u) => (
																<label
																	key={u.userId}
																	className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
																		selectedUserIds.has(u.userId)
																			? "border-amber-400 bg-amber-100 text-amber-800"
																			: "border-slate-200 bg-white text-slate-700 hover:bg-amber-50"
																	}`}
																>
																	<input
																		type="checkbox"
																		className="sr-only"
																		checked={selectedUserIds.has(u.userId)}
																		onChange={() => toggleUser(u.userId)}
																	/>
																	{u.userName}
																</label>
															))}
														</div>
													</div>
												)}
												{unavailableUsers.length > 0 && (
													<div>
														<h4 className="mb-1.5 text-xs font-semibold text-slate-500">
															❌ Not Available
														</h4>
														<div className="flex flex-wrap gap-2">
															{unavailableUsers.map((u) => (
																<label
																	key={u.userId}
																	className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium opacity-60 transition-colors ${
																		selectedUserIds.has(u.userId)
																			? "border-red-400 bg-red-100 text-red-800"
																			: "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
																	}`}
																>
																	<input
																		type="checkbox"
																		className="sr-only"
																		checked={selectedUserIds.has(u.userId)}
																		onChange={() => toggleUser(u.userId)}
																	/>
																	{u.userName}
																</label>
															))}
														</div>
													</div>
												)}
											</div>
										)}

										{/* Non-availability members */}
										{!hasAvailData && unassignedMembers.length > 0 && (
											<div className="mb-4">
												<h4 className="mb-2 text-xs font-semibold text-slate-700">
													Select Members
												</h4>
												<div className="flex flex-wrap gap-2">
													{unassignedMembers.map((m) => (
														<label
															key={m.id}
															className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
																selectedUserIds.has(m.id)
																	? "border-emerald-400 bg-emerald-100 text-emerald-800"
																	: "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50"
															}`}
														>
															<input
																type="checkbox"
																className="sr-only"
																checked={selectedUserIds.has(m.id)}
																onChange={() => toggleUser(m.id)}
															/>
															{m.name}
														</label>
													))}
												</div>
											</div>
										)}

										{/* Role input */}
										<div className="mb-4">
											<label
												htmlFor="assign-role"
												className="block text-xs font-medium text-slate-700"
											>
												Role (optional)
											</label>
											<input
												id="assign-role"
												name="role"
												type="text"
												value={assignRole}
												onChange={(e) => setAssignRole(e.target.value)}
												placeholder="e.g., Performer, Tech, Host"
												className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
											/>
										</div>

										<button
											type="submit"
											disabled={isSubmitting || selectedUserIds.size === 0}
											className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{isSubmitting
												? "Adding..."
												: `Add ${selectedUserIds.size} Member${selectedUserIds.size !== 1 ? "s" : ""}`}
										</button>
									</Form>
								</div>
							)}
						</div>
					)}

					{/* Legacy assignments for shows (non-Performer/Viewer roles) */}
					{isShow && otherAssignments.length > 0 && (
						<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
							<div className="border-b border-slate-100 px-6 py-4">
								<h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
									<Users className="h-5 w-5" /> Other Roles ({otherAssignments.length})
								</h3>
							</div>
							<ul className="divide-y divide-slate-100">
								{otherAssignments.map((a) => {
									const statusCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
									return (
										<li key={a.userId} className="flex items-center justify-between px-6 py-3">
											<div>
												<span className="text-sm font-medium text-slate-900">{a.userName}</span>
												{a.role && <span className="ml-2 text-xs text-slate-500">{a.role}</span>}
											</div>
											<div className="flex items-center gap-2">
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.badgeClass}`}
												>
													{statusCfg.label}
												</span>
												{isAdmin && (
													<Form method="post">
														<input type="hidden" name="intent" value="remove-assignment" />
														<input type="hidden" name="userId" value={a.userId} />
														<button
															type="submit"
															className="text-slate-400 transition-colors hover:text-red-500"
															title="Remove"
														>
															<X className="h-4 w-4" />
														</button>
													</Form>
												)}
											</div>
										</li>
									);
								})}
							</ul>
						</div>
					)}
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Your Status */}
					{myAssignment && (
						<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
							<h3 className="text-sm font-semibold text-slate-900">Your Status</h3>
							{myAssignment.role && (
								<p className="mt-1 text-xs text-slate-500">
									Role: <span className="font-medium text-slate-700">{myAssignment.role}</span>
								</p>
							)}
							{isShow && callTimeStr && isMyPerformer && (
								<p className="mt-1 text-xs text-purple-600">📍 Arrive by {callTimeStr}</p>
							)}
							{myAssignment.status === "confirmed" ? (
								<div className="mt-3">
									<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
										<Check className="h-4 w-4" /> Confirmed
									</span>
									<Form method="post" className="mt-3">
										<input type="hidden" name="intent" value="decline" />
										<button type="submit" className="text-xs text-slate-500 hover:text-red-600">
											Change to Declined
										</button>
									</Form>
								</div>
							) : myAssignment.status === "declined" ? (
								<div className="mt-3">
									<span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
										<X className="h-4 w-4" /> Declined
									</span>
									<Form method="post" className="mt-3">
										<input type="hidden" name="intent" value="confirm" />
										<button type="submit" className="text-xs text-slate-500 hover:text-emerald-600">
											Change to Confirmed
										</button>
									</Form>
								</div>
							) : (
								<div className="mt-3 flex gap-2">
									<Form method="post">
										<input type="hidden" name="intent" value="confirm" />
										<button
											type="submit"
											disabled={isSubmitting}
											className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
										>
											<Check className="h-4 w-4" /> Confirm
										</button>
									</Form>
									<Form method="post">
										<input type="hidden" name="intent" value="decline" />
										<button
											type="submit"
											disabled={isSubmitting}
											className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
										>
											<X className="h-4 w-4" /> Decline
										</button>
									</Form>
								</div>
							)}
						</div>
					)}

					{/* Self-register for non-show events */}
					{!isShow && canSelfRegister && (
						<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
							<h3 className="text-sm font-semibold text-slate-900">Attending?</h3>
							<p className="mt-1 text-xs text-slate-500">Let your group know you'll be there.</p>
							<Form method="post" className="mt-3">
								<input type="hidden" name="intent" value="attend" />
								<button
									type="submit"
									disabled={isSubmitting}
									className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
								>
									<Calendar className="h-4 w-4" /> I'll be there
								</button>
							</Form>
						</div>
					)}

					{/* Quick Stats */}
					<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h3 className="text-sm font-semibold text-slate-900">
							{isShow ? "Show Summary" : "Cast Summary"}
						</h3>
						<dl className="mt-4 space-y-3">
							{isShow ? (
								<>
									<div className="flex justify-between">
										<dt className="text-sm text-purple-600">Performers</dt>
										<dd className="text-sm font-medium text-purple-600">{performers.length}</dd>
									</div>
									<div className="flex justify-between">
										<dt className="text-sm text-slate-500">Viewers</dt>
										<dd className="text-sm font-medium text-slate-600">{viewers.length}</dd>
									</div>
								</>
							) : (
								<div className="flex justify-between">
									<dt className="text-sm text-slate-500">Total Assigned</dt>
									<dd className="text-sm font-medium text-slate-900">{assignments.length}</dd>
								</div>
							)}
							<div className="flex justify-between">
								<dt className="text-sm text-emerald-600">Confirmed</dt>
								<dd className="text-sm font-medium text-emerald-600">
									{assignments.filter((a) => a.status === "confirmed").length}
								</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-sm text-amber-600">Pending</dt>
								<dd className="text-sm font-medium text-amber-600">
									{assignments.filter((a) => a.status === "pending").length}
								</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-sm text-red-600">Declined</dt>
								<dd className="text-sm font-medium text-red-600">
									{assignments.filter((a) => a.status === "declined").length}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</div>
		</div>
	);
}
