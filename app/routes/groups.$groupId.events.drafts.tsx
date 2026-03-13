import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useNavigate, useParams, useRouteLoaderData } from "@remix-run/react";
import { ArrowLeft, CalendarDays, CheckSquare, Edit2, MapPin, Square, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatEventTime } from "~/lib/date-utils";
import type { DraftEvent } from "~/lib/draft-storage";
import { deleteDraftEvent, getDraftEvents } from "~/lib/draft-storage";
import { requireGroupMember } from "~/services/groups.server";
import type { loader as groupLayoutLoader } from "./groups.$groupId";

export const meta: MetaFunction = () => {
	return [{ title: "Draft Events — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupMember(request, groupId);
	return { groupId };
}

const EVENT_TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
	show: { emoji: "🎭", label: "Show", color: "bg-purple-100 text-purple-700 border-purple-200" },
	rehearsal: {
		emoji: "🎯",
		label: "Rehearsal",
		color: "bg-emerald-100 text-emerald-700 border-emerald-200",
	},
	other: { emoji: "📅", label: "Other", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

export default function DraftEvents() {
	const { groupId } = useLoaderData<typeof loader>();
	const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
	const navigate = useNavigate();
	const { groupId: paramsGroupId } = useParams();

	const [drafts, setDrafts] = useState<DraftEvent[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [showPublishModal, setShowPublishModal] = useState(false);

	// Load drafts on mount and after actions
	useEffect(() => {
		setDrafts(getDraftEvents(groupId));
	}, [groupId]);

	const toggleSelect = (id: string) => {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedIds(next);
	};

	const toggleSelectAll = () => {
		if (selectedIds.size === drafts.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(drafts.map((d) => d.id)));
		}
	};

	const handleDelete = (id: string) => {
		if (confirm("Delete this draft?")) {
			deleteDraftEvent(id);
			setDrafts(getDraftEvents(groupId));
			setSelectedIds((prev) => {
				const next = new Set(prev);
				next.delete(id);
				return next;
			});
		}
	};

	const handlePublishSelected = () => {
		if (selectedIds.size === 0) return;
		setShowPublishModal(true);
	};

	const handlePublishAll = () => {
		if (drafts.length === 0) return;
		setSelectedIds(new Set(drafts.map((d) => d.id)));
		setShowPublishModal(true);
	};

	const allSelected = drafts.length > 0 && selectedIds.size === drafts.length;

	return (
		<div className="max-w-5xl">
			{/* Header */}
			<div className="mb-6">
				<Link
					to={`/groups/${paramsGroupId}/events`}
					className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Events
				</Link>
				<div className="mt-2 flex items-center justify-between">
					<div>
						<h2 className="text-2xl font-bold text-slate-900">Draft Events</h2>
						<p className="mt-1 text-sm text-slate-600">
							Events saved as drafts are not yet published and won't trigger notifications.
						</p>
					</div>
				</div>
			</div>

			{drafts.length === 0 ? (
				<div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
					<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
						📋
					</div>
					<h3 className="text-lg font-semibold text-slate-900">No drafts yet</h3>
					<p className="mt-1 text-sm text-slate-600">
						Create events and save them as drafts to batch publish later.
					</p>
					<Link
						to={`/groups/${paramsGroupId}/events/new`}
						className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
					>
						Create Event
					</Link>
				</div>
			) : (
				<div>
					{/* Action Bar */}
					<div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={toggleSelectAll}
								className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
							>
								{allSelected ? (
									<CheckSquare className="h-4 w-4 text-emerald-600" />
								) : (
									<Square className="h-4 w-4" />
								)}
								{allSelected ? "Deselect All" : "Select All"}
							</button>
							<span className="text-sm text-slate-500">
								{selectedIds.size > 0 ? `${selectedIds.size} selected` : `${drafts.length} drafts`}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handlePublishSelected}
								disabled={selectedIds.size === 0}
								className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Publish Selected ({selectedIds.size})
							</button>
							<button
								type="button"
								onClick={handlePublishAll}
								className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
							>
								Publish All ({drafts.length})
							</button>
						</div>
					</div>

					{/* Draft List */}
					<div className="space-y-3">
						{drafts.map((draft) => {
							const config = EVENT_TYPE_CONFIG[draft.eventType] ?? EVENT_TYPE_CONFIG.other;
							const isSelected = selectedIds.has(draft.id);

							return (
								<div
									key={draft.id}
									className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
										isSelected
											? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200"
											: "border-slate-200 hover:border-slate-300"
									}`}
								>
									<div className="flex items-start gap-4">
										{/* Checkbox */}
										<button
											type="button"
											onClick={() => toggleSelect(draft.id)}
											className="mt-1 flex-shrink-0"
										>
											{isSelected ? (
												<CheckSquare className="h-5 w-5 text-emerald-600" />
											) : (
												<Square className="h-5 w-5 text-slate-400 hover:text-slate-600" />
											)}
										</button>

										{/* Content */}
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<span
													className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.color}`}
												>
													{config.emoji} {config.label}
												</span>
												<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
													DRAFT
												</span>
											</div>
											<h3 className="mt-1.5 text-base font-semibold text-slate-900">
												{draft.title}
											</h3>
											<div className="mt-2 space-y-1">
												<div className="flex items-center gap-1.5 text-sm text-slate-600">
													<CalendarDays className="h-4 w-4" />
													{formatEventTime(
														`${draft.date}T${draft.startTime}`,
														`${draft.date}T${draft.endTime}`,
														draft.timezone,
													)}
												</div>
												{draft.location && (
													<div className="flex items-center gap-1.5 text-sm text-slate-600">
														<MapPin className="h-4 w-4" />
														{draft.location}
													</div>
												)}
											</div>
											{draft.description && (
												<p className="mt-2 text-sm text-slate-600 line-clamp-2">
													{draft.description}
												</p>
											)}
										</div>

										{/* Actions */}
										<div className="flex flex-shrink-0 items-center gap-2">
											<Link
												to={`/groups/${paramsGroupId}/events/drafts/${draft.id}/edit`}
												className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
											>
												<Edit2 className="h-4 w-4" />
											</Link>
											<button
												type="button"
												onClick={() => handleDelete(draft.id)}
												className="rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Publish Confirmation Modal */}
			{showPublishModal && (
				<PublishModal
					drafts={drafts.filter((d) => selectedIds.has(d.id))}
					groupName={parentData?.group?.name ?? ""}
					groupId={groupId}
					onClose={() => setShowPublishModal(false)}
					onConfirm={() => {
						// In real implementation, this would call the API to publish
						// For prototype, we'll simulate it
						alert(
							`Published ${selectedIds.size} event${selectedIds.size !== 1 ? "s" : ""}. 1 notification sent to group members.`,
						);
						// Clear drafts
						const all = getDraftEvents(groupId);
						all.forEach((d) => {
							if (selectedIds.has(d.id)) {
								deleteDraftEvent(d.id);
							}
						});
						setDrafts(getDraftEvents(groupId));
						setSelectedIds(new Set());
						setShowPublishModal(false);
						navigate(`/groups/${groupId}/events`);
					}}
				/>
			)}
		</div>
	);
}

function PublishModal({
	drafts,
	groupName,
	groupId,
	onClose,
	onConfirm,
}: {
	drafts: DraftEvent[];
	groupName: string;
	groupId: string;
	onClose: () => void;
	onConfirm: () => void;
}) {
	const participantCount = 8; // Mock data

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
				{/* Header */}
				<div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
					<h3 className="text-lg font-bold text-slate-900">Publish Events</h3>
					<p className="mt-1 text-sm text-slate-600">
						Review events before publishing. This will send <strong>1 notification</strong> to{" "}
						<strong>{participantCount} participants</strong> about{" "}
						<strong>
							{drafts.length} event{drafts.length !== 1 ? "s" : ""}
						</strong>
						.
					</p>
				</div>

				{/* Event List */}
				<div className="max-h-96 overflow-y-auto p-6">
					<div className="space-y-3">
						{drafts.map((draft, idx) => {
							const config = EVENT_TYPE_CONFIG[draft.eventType] ?? EVENT_TYPE_CONFIG.other;
							return (
								<div
									key={draft.id}
									className="rounded-lg border border-slate-200 bg-slate-50 p-4"
								>
									<div className="flex items-start gap-3">
										<div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
											{idx + 1}
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<span
													className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.color}`}
												>
													{config.emoji} {config.label}
												</span>
											</div>
											<h4 className="mt-1 font-semibold text-slate-900">{draft.title}</h4>
											<div className="mt-1 space-y-0.5">
												<div className="flex items-center gap-1.5 text-xs text-slate-600">
													<CalendarDays className="h-3.5 w-3.5" />
													{formatEventTime(
														`${draft.date}T${draft.startTime}`,
														`${draft.date}T${draft.endTime}`,
														draft.timezone,
													)}
												</div>
												{draft.location && (
													<div className="flex items-center gap-1.5 text-xs text-slate-600">
														<MapPin className="h-3.5 w-3.5" />
														{draft.location}
													</div>
												)}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Footer */}
				<div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
					<div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
						<p className="text-sm text-emerald-800">
							✅ <strong>Ready to publish:</strong> {drafts.length} event
							{drafts.length !== 1 ? "s" : ""} will be added to your calendar and{" "}
							<strong>1 consolidated email</strong> will be sent to {participantCount} group members.
						</p>
					</div>
					<div className="flex items-center justify-end gap-3">
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={onConfirm}
							className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
						>
							Publish {drafts.length} Event{drafts.length !== 1 ? "s" : ""}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
