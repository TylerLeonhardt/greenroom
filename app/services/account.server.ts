import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import {
	availabilityRequests,
	availabilityResponses,
	eventAssignments,
	events,
	groupMemberships,
	groups,
	users,
} from "../../src/db/schema.js";
import { type GroupDecision, parseGroupDecisions } from "../lib/account-deletion.js";
import { logger } from "./logger.server.js";

// --- Types ---

export interface GroupOwnershipInfo {
	groupId: string;
	groupName: string;
	role: "admin" | "member";
	isSoleAdmin: boolean;
	memberCount: number;
	otherAdmins: Array<{ id: string; name: string }>;
	otherMembers: Array<{ id: string; name: string }>;
}

export interface AccountDeletionPreview {
	soleAdminGroups: GroupOwnershipInfo[];
	sharedAdminGroups: GroupOwnershipInfo[];
	memberOnlyGroups: GroupOwnershipInfo[];
	createdRequestCount: number;
	createdEventCount: number;
}

// --- Preview ---

export async function getAccountDeletionPreview(userId: string): Promise<AccountDeletionPreview> {
	// Get all groups user is in
	const memberships = await db
		.select({
			groupId: groupMemberships.groupId,
			role: groupMemberships.role,
			groupName: groups.name,
		})
		.from(groupMemberships)
		.innerJoin(groups, eq(groupMemberships.groupId, groups.id))
		.where(eq(groupMemberships.userId, userId));

	const soleAdminGroups: GroupOwnershipInfo[] = [];
	const sharedAdminGroups: GroupOwnershipInfo[] = [];
	const memberOnlyGroups: GroupOwnershipInfo[] = [];

	for (const membership of memberships) {
		// Get all members of this group (excluding the current user)
		const allMembers = await db
			.select({
				userId: groupMemberships.userId,
				role: groupMemberships.role,
				name: users.name,
			})
			.from(groupMemberships)
			.innerJoin(users, eq(groupMemberships.userId, users.id))
			.where(eq(groupMemberships.groupId, membership.groupId));

		const otherMembers = allMembers.filter((m) => m.userId !== userId);
		const otherAdmins = otherMembers.filter((m) => m.role === "admin");
		const otherNonAdmins = otherMembers.filter((m) => m.role !== "admin");

		const info: GroupOwnershipInfo = {
			groupId: membership.groupId,
			groupName: membership.groupName,
			role: membership.role as "admin" | "member",
			isSoleAdmin: membership.role === "admin" && otherAdmins.length === 0,
			memberCount: allMembers.length,
			otherAdmins: otherAdmins.map((m) => ({ id: m.userId, name: m.name })),
			otherMembers: otherNonAdmins.map((m) => ({ id: m.userId, name: m.name })),
		};

		if (membership.role === "admin") {
			if (otherAdmins.length === 0) {
				soleAdminGroups.push(info);
			} else {
				sharedAdminGroups.push(info);
			}
		} else {
			memberOnlyGroups.push(info);
		}
	}

	// Count created content
	const [requestCount] = await db
		.select({ count: count() })
		.from(availabilityRequests)
		.where(eq(availabilityRequests.createdById, userId));

	const [eventCount] = await db
		.select({ count: count() })
		.from(events)
		.where(eq(events.createdById, userId));

	return {
		soleAdminGroups,
		sharedAdminGroups,
		memberOnlyGroups,
		createdRequestCount: requestCount?.count ?? 0,
		createdEventCount: eventCount?.count ?? 0,
	};
}

// --- Execute Deletion ---

export class AccountDeletionValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AccountDeletionValidationError";
	}
}

export async function executeAccountDeletion(
	userId: string,
	decisions: GroupDecision[],
): Promise<void> {
	await db.transaction(async (tx) => {
		const validatedDecisions = parseGroupDecisions(decisions);
		if (!validatedDecisions) {
			throw new AccountDeletionValidationError("Invalid group decisions.");
		}

		// Lock the user's memberships first, then the administered groups and all their
		// memberships. The group locks prevent new memberships while the membership locks
		// stabilize admin roles for the remainder of the transaction.
		const userMemberships = await tx
			.select({
				groupId: groupMemberships.groupId,
				role: groupMemberships.role,
			})
			.from(groupMemberships)
			.where(eq(groupMemberships.userId, userId))
			.for("update");
		const administeredGroupIds = userMemberships
			.filter((membership) => membership.role === "admin")
			.map((membership) => membership.groupId);

		let administeredMemberships: Array<{
			groupId: string;
			userId: string;
			role: "admin" | "member";
		}> = [];
		if (administeredGroupIds.length > 0) {
			await tx
				.select({ id: groups.id })
				.from(groups)
				.where(inArray(groups.id, administeredGroupIds))
				.for("update");
			administeredMemberships = await tx
				.select({
					groupId: groupMemberships.groupId,
					userId: groupMemberships.userId,
					role: groupMemberships.role,
				})
				.from(groupMemberships)
				.where(inArray(groupMemberships.groupId, administeredGroupIds))
				.for("update");
		}

		const soleAdminGroupIds = new Set(
			administeredGroupIds.filter((groupId) => {
				const adminCount = administeredMemberships.filter(
					(membership) => membership.groupId === groupId && membership.role === "admin",
				).length;
				return adminCount === 1;
			}),
		);
		if (
			validatedDecisions.length !== soleAdminGroupIds.size ||
			validatedDecisions.some((decision) => !soleAdminGroupIds.has(decision.groupId))
		) {
			throw new AccountDeletionValidationError(
				"Group ownership changed. Review your account deletion choices and try again.",
			);
		}

		// 1. Handle sole-admin groups per user decisions
		for (const decision of validatedDecisions) {
			const verifiedGroupId = [...soleAdminGroupIds].find(
				(groupId) => groupId === decision.groupId,
			);
			if (!verifiedGroupId) {
				throw new AccountDeletionValidationError("Invalid group decision.");
			}

			if (decision.action === "transfer") {
				const transferTarget = administeredMemberships.find(
					(membership) =>
						membership.groupId === verifiedGroupId &&
						membership.userId === decision.newAdminId &&
						membership.userId !== userId,
				);
				if (!transferTarget) {
					throw new AccountDeletionValidationError(
						"Selected transfer target is not a member of the group.",
					);
				}
				const verifiedNewAdminId = transferTarget.userId;

				// Promote the new admin
				await tx
					.update(groupMemberships)
					.set({ role: "admin" })
					.where(
						and(
							eq(groupMemberships.groupId, verifiedGroupId),
							eq(groupMemberships.userId, verifiedNewAdminId),
						),
					);

				// Reassign createdById on the group itself
				await tx
					.update(groups)
					.set({ createdById: verifiedNewAdminId, updatedAt: new Date() })
					.where(eq(groups.id, verifiedGroupId));

				// Reassign createdById on availability requests in this group
				await tx
					.update(availabilityRequests)
					.set({ createdById: verifiedNewAdminId })
					.where(
						and(
							eq(availabilityRequests.groupId, verifiedGroupId),
							eq(availabilityRequests.createdById, userId),
						),
					);

				// Reassign createdById on events in this group
				await tx
					.update(events)
					.set({ createdById: verifiedNewAdminId, updatedAt: new Date() })
					.where(and(eq(events.groupId, verifiedGroupId), eq(events.createdById, userId)));

				// Remove the departing user's membership
				await tx
					.delete(groupMemberships)
					.where(
						and(eq(groupMemberships.groupId, verifiedGroupId), eq(groupMemberships.userId, userId)),
					);

				logger.info(
					{ userId, groupId: verifiedGroupId, newAdminId: verifiedNewAdminId },
					"Transferred group ownership during account deletion",
				);
			} else if (decision.action === "delete") {
				// Use direct delete — FK cascades handle cleanup
				await tx.delete(groups).where(eq(groups.id, verifiedGroupId));

				logger.info({ userId, groupId: verifiedGroupId }, "Deleted group during account deletion");
			}
		}

		// 2. Handle shared-admin groups: reassign createdById to another admin, remove membership
		const remainingAdminMemberships = await tx
			.select({
				groupId: groupMemberships.groupId,
				role: groupMemberships.role,
			})
			.from(groupMemberships)
			.where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.role, "admin")));

		for (const membership of remainingAdminMemberships) {
			// Find another admin in this group to reassign to (exclude the departing user)
			const [otherAdmin] = await tx
				.select({ userId: groupMemberships.userId })
				.from(groupMemberships)
				.where(
					and(
						eq(groupMemberships.groupId, membership.groupId),
						eq(groupMemberships.role, "admin"),
						ne(groupMemberships.userId, userId),
					),
				)
				.limit(1);

			if (otherAdmin) {
				// Reassign createdById references
				await tx
					.update(availabilityRequests)
					.set({ createdById: otherAdmin.userId })
					.where(
						and(
							eq(availabilityRequests.groupId, membership.groupId),
							eq(availabilityRequests.createdById, userId),
						),
					);

				await tx
					.update(events)
					.set({ createdById: otherAdmin.userId, updatedAt: new Date() })
					.where(and(eq(events.groupId, membership.groupId), eq(events.createdById, userId)));

				await tx
					.update(groups)
					.set({ createdById: otherAdmin.userId, updatedAt: new Date() })
					.where(and(eq(groups.id, membership.groupId), eq(groups.createdById, userId)));
			}
		}

		// 3. Remove all remaining memberships (handles member-only groups too)
		// FK cascades on groupMemberships.userId will handle this on user soft-delete,
		// but we explicitly remove memberships now to clean up properly
		await tx.delete(groupMemberships).where(eq(groupMemberships.userId, userId));

		// 4. Delete availability responses (explicit, though CASCADE would handle it)
		await tx.delete(availabilityResponses).where(eq(availabilityResponses.userId, userId));

		// 5. Delete/decline event assignments
		await tx.delete(eventAssignments).where(eq(eventAssignments.userId, userId));

		// 6. Soft-delete the user
		await tx
			.update(users)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(eq(users.id, userId));

		logger.info({ userId }, "Account soft-deleted");
	});
}
