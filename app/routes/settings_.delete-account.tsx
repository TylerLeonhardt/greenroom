import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { AlertTriangle, ArrowLeft, ArrowRight, Shield, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import {
	type AccountDeletionPreview,
	executeAccountDeletion,
	type GroupDecision,
	getAccountDeletionPreview,
} from "~/services/account.server";
import { requireUser } from "~/services/auth.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { logger } from "~/services/logger.server";
import { destroyUserSession } from "~/services/session.server";

export const meta: MetaFunction = () => {
	return [{ title: "Delete Account — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await requireUser(request);
	const preview = await getAccountDeletionPreview(user.id);
	return { user, preview };
}

export async function action({ request }: ActionFunctionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	if (intent !== "delete-account") {
		return { error: "Invalid action." };
	}

	// Validate email confirmation
	const confirmEmail = formData.get("confirmEmail");
	if (typeof confirmEmail !== "string" || confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
		return { error: "Email does not match. Please type your exact email address." };
	}

	// Parse group decisions
	const decisionsJson = formData.get("decisions");
	let decisions: GroupDecision[] = [];
	if (typeof decisionsJson === "string" && decisionsJson) {
		try {
			decisions = JSON.parse(decisionsJson);
		} catch {
			return { error: "Invalid group decisions." };
		}
	}

	// Validate that all sole-admin groups have a decision
	const preview = await getAccountDeletionPreview(user.id);
	const soleAdminGroupIds = new Set(preview.soleAdminGroups.map((g) => g.groupId));
	const decidedGroupIds = new Set(decisions.map((d) => d.groupId));

	for (const groupId of soleAdminGroupIds) {
		if (!decidedGroupIds.has(groupId)) {
			return { error: "Please choose what to do with all groups where you are the only admin." };
		}
	}

	// Validate transfer targets are actual group members
	for (const decision of decisions) {
		if (decision.action === "transfer") {
			const group = preview.soleAdminGroups.find((g) => g.groupId === decision.groupId);
			if (!group) {
				return { error: `Invalid group: ${decision.groupId}` };
			}
			const validMemberIds = [
				...group.otherMembers.map((m) => m.id),
				...group.otherAdmins.map((m) => m.id),
			];
			if (!validMemberIds.includes(decision.newAdminId)) {
				return { error: "Selected transfer target is not a member of the group." };
			}
		}
	}

	try {
		await executeAccountDeletion(user.id, decisions);
		logger.info({ userId: user.id }, "Account deletion executed successfully");
		return destroyUserSession(request, "/");
	} catch (error) {
		logger.error(
			{ err: error, userId: user.id, route: "settings.delete-account" },
			"Account deletion failed",
		);
		return { error: "Failed to delete account. Please try again." };
	}
}

export default function DeleteAccount() {
	const { user, preview } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	const [step, setStep] = useState<"decisions" | "confirm">("decisions");
	const [confirmEmail, setConfirmEmail] = useState("");
	const [decisions, setDecisions] = useState<Record<string, GroupDecision>>({});

	const hasSoleAdminGroups = preview.soleAdminGroups.length > 0;

	// Check if all sole-admin groups have decisions
	const allDecisionsMade = preview.soleAdminGroups.every((g) => decisions[g.groupId]);

	const canProceed = !hasSoleAdminGroups || allDecisionsMade;
	const emailMatches = confirmEmail.toLowerCase() === user.email.toLowerCase();

	function setGroupDecision(groupId: string, action: "transfer" | "delete", newAdminId?: string) {
		setDecisions((prev) => ({
			...prev,
			[groupId]:
				action === "transfer"
					? { action: "transfer", groupId, newAdminId: newAdminId ?? "" }
					: { action: "delete", groupId },
		}));
	}

	function setTransferTarget(groupId: string, newAdminId: string) {
		setDecisions((prev) => ({
			...prev,
			[groupId]: { action: "transfer", groupId, newAdminId },
		}));
	}

	const decisionsArray = Object.values(decisions).filter(
		(d) => d.action === "delete" || (d.action === "transfer" && d.newAdminId),
	);

	return (
		<div className="mx-auto max-w-2xl">
			<Link
				to="/settings"
				className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to Settings
			</Link>

			<div className="mb-6">
				<h1 className="flex items-center gap-2 text-2xl font-bold text-red-600">
					<AlertTriangle className="h-6 w-6" />
					Delete Account
				</h1>
				<p className="mt-1 text-sm text-slate-600">
					This will delete your account and remove you from all groups. You have 30 days to
					reactivate by logging back in.
				</p>
			</div>

			{actionData && "error" in actionData && (
				<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			{step === "decisions" && (
				<div className="space-y-6">
					{/* Summary of what will happen */}
					<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<h2 className="text-lg font-semibold text-slate-900">What will happen</h2>
						<ul className="mt-3 space-y-2 text-sm text-slate-600">
							<li className="flex items-start gap-2">
								<span className="mt-0.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
								Your account will be deactivated for 30 days, then permanently deleted
							</li>
							<li className="flex items-start gap-2">
								<span className="mt-0.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
								You will be removed from{" "}
								{preview.soleAdminGroups.length +
									preview.sharedAdminGroups.length +
									preview.memberOnlyGroups.length}{" "}
								group(s)
							</li>
							{preview.createdRequestCount > 0 && (
								<li className="flex items-start gap-2">
									<span className="mt-0.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
									{preview.createdRequestCount} availability request(s) you created will be
									reassigned
								</li>
							)}
							{preview.createdEventCount > 0 && (
								<li className="flex items-start gap-2">
									<span className="mt-0.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
									{preview.createdEventCount} event(s) you created will be reassigned
								</li>
							)}
							<li className="flex items-start gap-2">
								<span className="mt-0.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
								Your availability responses and event assignments will be removed
							</li>
						</ul>
					</div>

					{/* Sole admin groups — require decisions */}
					{preview.soleAdminGroups.length > 0 && (
						<div className="rounded-xl border border-amber-300 bg-white shadow-sm">
							<div className="border-b border-amber-200 px-6 py-4">
								<h2 className="flex items-center gap-2 text-lg font-semibold text-amber-700">
									<Shield className="h-5 w-5" />
									Groups where you are the only admin
								</h2>
								<p className="mt-1 text-sm text-slate-600">
									These groups need your decision before deletion can proceed.
								</p>
							</div>
							<div className="divide-y divide-slate-100">
								{preview.soleAdminGroups.map((group) => (
									<SoleAdminGroupDecision
										key={group.groupId}
										group={group}
										decision={decisions[group.groupId]}
										onDecision={(action, newAdminId) =>
											setGroupDecision(group.groupId, action, newAdminId)
										}
										onTransferTargetChange={(newAdminId) =>
											setTransferTarget(group.groupId, newAdminId)
										}
									/>
								))}
							</div>
						</div>
					)}

					{/* Shared admin groups */}
					{preview.sharedAdminGroups.length > 0 && (
						<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
							<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
								<Users className="h-5 w-5 text-slate-400" />
								Groups with other admins
							</h2>
							<p className="mt-1 text-sm text-slate-600">
								Your admin role and created content will be reassigned to another admin.
							</p>
							<ul className="mt-3 space-y-1">
								{preview.sharedAdminGroups.map((group) => (
									<li key={group.groupId} className="text-sm text-slate-700">
										{group.groupName}{" "}
										<span className="text-slate-400">
											({group.memberCount} member{group.memberCount !== 1 ? "s" : ""})
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* Member-only groups */}
					{preview.memberOnlyGroups.length > 0 && (
						<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
							<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
								<Users className="h-5 w-5 text-slate-400" />
								Groups where you are a member
							</h2>
							<p className="mt-1 text-sm text-slate-600">You will be removed from these groups.</p>
							<ul className="mt-3 space-y-1">
								{preview.memberOnlyGroups.map((group) => (
									<li key={group.groupId} className="text-sm text-slate-700">
										{group.groupName}
									</li>
								))}
							</ul>
						</div>
					)}

					{/* No groups */}
					{preview.soleAdminGroups.length === 0 &&
						preview.sharedAdminGroups.length === 0 &&
						preview.memberOnlyGroups.length === 0 && (
							<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
								<p className="text-sm text-slate-600">You are not a member of any groups.</p>
							</div>
						)}

					<button
						type="button"
						onClick={() => setStep("confirm")}
						disabled={!canProceed}
						className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Continue
						<ArrowRight className="h-4 w-4" />
					</button>
				</div>
			)}

			{step === "confirm" && (
				<div className="space-y-6">
					<div className="rounded-xl border border-red-300 bg-white shadow-sm">
						<div className="border-b border-red-200 px-6 py-4">
							<h2 className="text-lg font-semibold text-red-600">Confirm Account Deletion</h2>
						</div>
						<div className="p-6">
							{/* Summary of decisions */}
							{Object.values(decisions).length > 0 && (
								<div className="mb-4 rounded-lg bg-slate-50 p-4">
									<h3 className="text-sm font-semibold text-slate-900">Your decisions:</h3>
									<ul className="mt-2 space-y-1">
										{Object.values(decisions).map((decision) => {
											const group = preview.soleAdminGroups.find(
												(g) => g.groupId === decision.groupId,
											);
											if (!group) return null;
											return (
												<li key={decision.groupId} className="text-sm text-slate-600">
													<span className="font-medium">{group.groupName}</span>
													{" — "}
													{decision.action === "delete"
														? "will be deleted"
														: `ownership transferred to ${
																[...group.otherMembers, ...group.otherAdmins].find(
																	(m) =>
																		decision.action === "transfer" && m.id === decision.newAdminId,
																)?.name ?? "selected member"
															}`}
												</li>
											);
										})}
									</ul>
								</div>
							)}

							<Form method="post">
								<CsrfInput />
								<input type="hidden" name="intent" value="delete-account" />
								<input type="hidden" name="decisions" value={JSON.stringify(decisionsArray)} />

								<div className="mb-4">
									<label
										htmlFor="confirmEmail"
										className="block text-sm font-medium text-slate-700"
									>
										Type <span className="font-semibold">{user.email}</span> to confirm:
									</label>
									<input
										id="confirmEmail"
										name="confirmEmail"
										type="text"
										autoComplete="off"
										value={confirmEmail}
										onChange={(e) => setConfirmEmail(e.target.value)}
										className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
										placeholder={user.email}
									/>
								</div>

								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={() => setStep("decisions")}
										className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
									>
										<ArrowLeft className="mr-1 inline h-4 w-4" />
										Back
									</button>
									<button
										type="submit"
										disabled={!emailMatches || isSubmitting}
										className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Trash2 className="h-4 w-4" />
										{isSubmitting ? "Deleting…" : "Permanently Delete My Account"}
									</button>
								</div>
							</Form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// --- Sub-Components ---

function SoleAdminGroupDecision({
	group,
	decision,
	onDecision,
	onTransferTargetChange,
}: {
	group: AccountDeletionPreview["soleAdminGroups"][0];
	decision: GroupDecision | undefined;
	onDecision: (action: "transfer" | "delete", newAdminId?: string) => void;
	onTransferTargetChange: (newAdminId: string) => void;
}) {
	const hasOtherMembers = group.otherMembers.length > 0 || group.otherAdmins.length > 0;
	const currentAction = decision?.action;

	return (
		<div className="p-6">
			<h3 className="text-sm font-semibold text-slate-900">{group.groupName}</h3>
			<p className="mt-1 text-xs text-slate-500">
				{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
			</p>

			<div className="mt-3 space-y-2">
				{hasOtherMembers && (
					<label className="flex items-start gap-2">
						<input
							type="radio"
							name={`decision-${group.groupId}`}
							checked={currentAction === "transfer"}
							onChange={() => onDecision("transfer")}
							className="mt-1 accent-emerald-600"
						/>
						<div>
							<span className="text-sm font-medium text-slate-700">
								Transfer ownership to another member
							</span>
							{currentAction === "transfer" && (
								<select
									value={decision?.action === "transfer" ? decision.newAdminId : ""}
									onChange={(e) => onTransferTargetChange(e.target.value)}
									className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								>
									<option value="">Select a member...</option>
									{[...group.otherAdmins, ...group.otherMembers].map((member) => (
										<option key={member.id} value={member.id}>
											{member.name}
										</option>
									))}
								</select>
							)}
						</div>
					</label>
				)}

				<label className="flex items-start gap-2">
					<input
						type="radio"
						name={`decision-${group.groupId}`}
						checked={currentAction === "delete"}
						onChange={() => onDecision("delete")}
						className="mt-1 accent-red-600"
					/>
					<div>
						<span className="text-sm font-medium text-red-600">
							Delete this group and all its data
						</span>
						<p className="text-xs text-slate-500">
							All members, availability requests, events, and assignments will be permanently
							deleted.
						</p>
					</div>
				</label>
			</div>
		</div>
	);
}
