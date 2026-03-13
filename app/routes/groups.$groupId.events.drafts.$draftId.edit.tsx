import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useNavigate, useParams } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { InlineTimezoneSelector } from "~/components/timezone-selector";
import type { DraftEvent } from "~/lib/draft-storage";
import { getDraftEvents, updateDraftEvent } from "~/lib/draft-storage";
import { requireGroupMember } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Edit Draft — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupMember(request, groupId);
	return { groupId, userTimezone: user.timezone };
}

export default function EditDraft() {
	const { groupId, userTimezone } = useLoaderData<typeof loader>();
	const { groupId: paramsGroupId, draftId } = useParams();
	const navigate = useNavigate();

	const [draft, setDraft] = useState<DraftEvent | null>(null);
	const [formData, setFormData] = useState({
		title: "",
		eventType: "rehearsal",
		date: "",
		startTime: "",
		endTime: "",
		location: "",
		description: "",
		timezone: userTimezone ?? "America/Los_Angeles",
	});

	useEffect(() => {
		const drafts = getDraftEvents(groupId);
		const found = drafts.find((d) => d.id === draftId);
		if (found) {
			setDraft(found);
			setFormData({
				title: found.title,
				eventType: found.eventType,
				date: found.date,
				startTime: found.startTime,
				endTime: found.endTime,
				location: found.location ?? "",
				description: found.description ?? "",
				timezone: found.timezone,
			});
		}
	}, [groupId, draftId]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!draftId) return;

		updateDraftEvent(draftId, {
			...formData,
			location: formData.location || undefined,
			description: formData.description || undefined,
		});

		navigate(`/groups/${paramsGroupId}/events/drafts`);
	};

	if (!draft) {
		return (
			<div className="max-w-3xl">
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
					Draft not found.
				</div>
				<Link
					to={`/groups/${paramsGroupId}/events/drafts`}
					className="mt-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Drafts
				</Link>
			</div>
		);
	}

	return (
		<div className="max-w-3xl">
			<div className="mb-6">
				<Link
					to={`/groups/${paramsGroupId}/events/drafts`}
					className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to Drafts
				</Link>
				<h2 className="mt-2 text-2xl font-bold text-slate-900">Edit Draft</h2>
			</div>

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Title & Type */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="space-y-4">
						<div>
							<label htmlFor="title" className="block text-sm font-medium text-slate-700">
								Title <span className="text-red-500">*</span>
							</label>
							<input
								id="title"
								name="title"
								type="text"
								required
								maxLength={200}
								value={formData.title}
								onChange={(e) => setFormData({ ...formData, title: e.target.value })}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<span className="block text-sm font-medium text-slate-700">
								Event Type <span className="text-red-500">*</span>
							</span>
							<div className="mt-2 flex flex-wrap gap-3">
								{[
									{
										value: "rehearsal",
										label: "🎯 Rehearsal",
										color:
											"peer-checked:bg-emerald-100 peer-checked:border-emerald-300 peer-checked:text-emerald-800",
									},
									{
										value: "show",
										label: "🎭 Show",
										color:
											"peer-checked:bg-purple-100 peer-checked:border-purple-300 peer-checked:text-purple-800",
									},
									{
										value: "other",
										label: "📅 Other",
										color:
											"peer-checked:bg-slate-200 peer-checked:border-slate-400 peer-checked:text-slate-800",
									},
								].map((type) => (
									<label key={type.value} className="cursor-pointer">
										<input
											type="radio"
											name="eventType"
											value={type.value}
											checked={formData.eventType === type.value}
											onChange={(e) => setFormData({ ...formData, eventType: e.target.value as any })}
											className="peer sr-only"
										/>
										<span
											className={`inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 ${type.color}`}
										>
											{type.label}
										</span>
									</label>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Date & Time */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="mb-4 text-sm font-semibold text-slate-900">Date & Time</h3>
					<div className="mb-4">
						<InlineTimezoneSelector
							timezone={formData.timezone}
							onChange={(tz) => setFormData({ ...formData, timezone: tz })}
						/>
					</div>
					<div className="grid gap-4 sm:grid-cols-3">
						<div>
							<label htmlFor="date" className="block text-sm font-medium text-slate-700">
								Date <span className="text-red-500">*</span>
							</label>
							<input
								id="date"
								name="date"
								type="date"
								required
								value={formData.date}
								onChange={(e) => setFormData({ ...formData, date: e.target.value })}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="startTime" className="block text-sm font-medium text-slate-700">
								Start Time <span className="text-red-500">*</span>
							</label>
							<input
								id="startTime"
								name="startTime"
								type="time"
								required
								value={formData.startTime}
								onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="endTime" className="block text-sm font-medium text-slate-700">
								End Time <span className="text-red-500">*</span>
							</label>
							<input
								id="endTime"
								name="endTime"
								type="time"
								required
								value={formData.endTime}
								onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
				</div>

				{/* Location & Description */}
				<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="space-y-4">
						<div>
							<label htmlFor="location" className="block text-sm font-medium text-slate-700">
								Location
							</label>
							<input
								id="location"
								name="location"
								type="text"
								maxLength={200}
								value={formData.location}
								onChange={(e) => setFormData({ ...formData, location: e.target.value })}
								placeholder="e.g., Studio A, Main Theater"
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label htmlFor="description" className="block text-sm font-medium text-slate-700">
								Description
							</label>
							<textarea
								id="description"
								name="description"
								rows={3}
								maxLength={2000}
								value={formData.description}
								onChange={(e) => setFormData({ ...formData, description: e.target.value })}
								placeholder="Any additional details..."
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
				</div>

				{/* Submit */}
				<div className="flex items-center gap-3">
					<button
						type="submit"
						className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2"
					>
						Save Changes
					</button>
					<Link
						to={`/groups/${paramsGroupId}/events/drafts`}
						className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						Cancel
					</Link>
				</div>
			</form>
		</div>
	);
}
