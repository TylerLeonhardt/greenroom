import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { CsrfInput } from "~/components/csrf-input";
import { validateCsrfToken } from "~/services/csrf.server";
import {
	getGroupById,
	regenerateInviteCode,
	requireGroupAdmin,
	updateGroup,
	updateGroupPermissions,
} from "~/services/groups.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupAdmin(request, groupId);
	const group = await getGroupById(groupId);
	if (!group) throw new Response("Not Found", { status: 404 });
	return { group };
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	await requireGroupAdmin(request, groupId);
	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	if (intent === "update") {
		const name = formData.get("name");
		const description = formData.get("description");

		if (typeof name !== "string" || !name.trim()) {
			return { error: "Group name is required.", success: false };
		}

		if (name.trim().length > 100) {
			return { error: "Group name must be 100 characters or less.", success: false };
		}

		if (typeof description === "string" && description.trim().length > 2000) {
			return { error: "Description must be 2000 characters or less.", success: false };
		}

		try {
			await updateGroup(groupId, {
				name,
				description: typeof description === "string" ? description : undefined,
			});
			return { success: true, message: "Group updated successfully." };
		} catch {
			return { error: "Failed to update group.", success: false };
		}
	}

	if (intent === "regenerate-code") {
		try {
			const newCode = await regenerateInviteCode(groupId);
			return { success: true, message: `Invite code regenerated: ${newCode}` };
		} catch {
			return { error: "Failed to regenerate invite code.", success: false };
		}
	}

	if (intent === "update-permissions") {
		try {
			await updateGroupPermissions(groupId, {
				membersCanCreateRequests: formData.get("membersCanCreateRequests") === "on",
				membersCanCreateEvents: formData.get("membersCanCreateEvents") === "on",
			});
			return { success: true, message: "Member permissions updated." };
		} catch {
			return { error: "Failed to update permissions.", success: false };
		}
	}

	return { error: "Invalid action.", success: false };
}

export default function GroupSettings() {
	const { group } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="max-w-2xl space-y-8">
			{/* Success/Error Banner */}
			{actionData?.success && "message" in actionData && (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{actionData.message}
				</div>
			)}
			{actionData && "error" in actionData && actionData.error && (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			{/* Edit Group */}
			<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-100 px-6 py-4">
					<h2 className="text-lg font-semibold text-slate-900">Group Details</h2>
					<p className="mt-1 text-sm text-slate-500">
						Update your group&apos;s name and description
					</p>
				</div>
				<Form method="post" className="space-y-4 p-6">
					<CsrfInput />
					<input type="hidden" name="intent" value="update" />
					<div>
						<label htmlFor="name" className="block text-sm font-medium text-slate-700">
							Group Name
						</label>
						<input
							id="name"
							name="name"
							type="text"
							required
							maxLength={100}
							defaultValue={group.name}
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
							defaultValue={group.description ?? ""}
							className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
						/>
					</div>
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:opacity-50"
					>
						{isSubmitting ? "Saving…" : "Save Changes"}
					</button>
				</Form>
			</div>

			{/* Invite Code */}
			<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-100 px-6 py-4">
					<h2 className="text-lg font-semibold text-slate-900">Invite Code</h2>
					<p className="mt-1 text-sm text-slate-500">
						Share this code with people you want to invite
					</p>
				</div>
				<div className="p-6">
					<div className="flex items-center gap-3">
						<code className="flex-1 rounded-lg bg-slate-100 px-4 py-3 text-center font-mono text-xl tracking-widest text-slate-900">
							{group.inviteCode}
						</code>
						<button
							type="button"
							onClick={() => navigator.clipboard.writeText(group.inviteCode)}
							className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
						>
							Copy
						</button>
					</div>
					<Form method="post" className="mt-4">
						<CsrfInput />
						<input type="hidden" name="intent" value="regenerate-code" />
						<button
							type="submit"
							className="text-sm text-slate-500 underline hover:text-slate-700"
							onClick={(e) => {
								if (
									!confirm(
										"Regenerating the invite code will invalidate the current one. Continue?",
									)
								) {
									e.preventDefault();
								}
							}}
						>
							Regenerate invite code
						</button>
					</Form>
				</div>
			</div>

			{/* Member Permissions */}
			<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-100 px-6 py-4">
					<h2 className="text-lg font-semibold text-slate-900">Member Permissions</h2>
					<p className="mt-1 text-sm text-slate-500">
						Control what regular members can do in this group
					</p>
				</div>
				<Form method="post" className="p-6">
					<CsrfInput />
					<input type="hidden" name="intent" value="update-permissions" />
					<div className="space-y-4">
						<label className="flex items-center justify-between gap-4">
							<div>
								<span className="text-sm font-medium text-slate-700">
									Allow members to create availability requests
								</span>
								<p className="text-xs text-slate-500">
									Members can create scheduling polls, not just admins
								</p>
							</div>
							<input
								type="checkbox"
								name="membersCanCreateRequests"
								defaultChecked={group.membersCanCreateRequests}
								className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
							/>
						</label>
						<label className="flex items-center justify-between gap-4">
							<div>
								<span className="text-sm font-medium text-slate-700">
									Allow members to create events
								</span>
								<p className="text-xs text-slate-500">
									Members can create rehearsals, shows, and other events
								</p>
							</div>
							<input
								type="checkbox"
								name="membersCanCreateEvents"
								defaultChecked={group.membersCanCreateEvents}
								className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
							/>
						</label>
					</div>
					<button
						type="submit"
						disabled={isSubmitting}
						className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:opacity-50"
					>
						{isSubmitting ? "Saving…" : "Save Permissions"}
					</button>
				</Form>
			</div>
		</div>
	);
}
