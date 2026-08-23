import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../src/db/index.js";
import {
	availabilityRequests,
	events,
	groupMemberships,
	groups,
	users,
} from "../../../src/db/schema.js";
import {
	AccountDeletionValidationError,
	executeAccountDeletion,
	getAccountDeletionPreview,
} from "../account.server.js";
import {
	addGroupMember,
	createTestAvailabilityRequest,
	createTestEvent,
	createTestGroup,
	createTestUser,
} from "./seed.js";
import { cleanDatabase } from "./setup.js";

beforeEach(async () => {
	await cleanDatabase();
});

describe("account deletion service integration", () => {
	it("rejects a foreign group decision and rolls back every destructive change", async () => {
		const attacker = await createTestUser();
		const victim = await createTestUser();
		const attackerGroup = await createTestGroup(attacker.id);
		const victimGroup = await createTestGroup(victim.id);
		const victimEvent = await createTestEvent(victimGroup.id, victim.id);

		await expect(
			executeAccountDeletion(attacker.id, [
				{ action: "delete", groupId: attackerGroup.id },
				{ action: "delete", groupId: victimGroup.id },
			]),
		).rejects.toBeInstanceOf(AccountDeletionValidationError);

		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, attackerGroup.id)),
		).toHaveLength(1);
		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, victimGroup.id)),
		).toHaveLength(1);
		expect(
			await db.select({ id: events.id }).from(events).where(eq(events.id, victimEvent.id)),
		).toHaveLength(1);
	});

	it("re-checks sole-admin ownership after the preview and rejects a stale delete", async () => {
		const user = await createTestUser();
		const newAdmin = await createTestUser();
		const group = await createTestGroup(user.id);
		const preview = await getAccountDeletionPreview(user.id);
		expect(preview.soleAdminGroups.map((item) => item.groupId)).toEqual([group.id]);

		await addGroupMember(group.id, newAdmin.id);
		await db
			.update(groupMemberships)
			.set({ role: "admin" })
			.where(and(eq(groupMemberships.groupId, group.id), eq(groupMemberships.userId, newAdmin.id)));

		await expect(
			executeAccountDeletion(user.id, [{ action: "delete", groupId: group.id }]),
		).rejects.toThrow("Group ownership changed");
		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, group.id)),
		).toHaveLength(1);
		const [userRow] = await db
			.select({ deletedAt: users.deletedAt })
			.from(users)
			.where(eq(users.id, user.id));
		expect(userRow?.deletedAt).toBeNull();
	});

	it("rejects a transfer target whose membership changed before execution", async () => {
		const user = await createTestUser();
		const formerMember = await createTestUser();
		const group = await createTestGroup(user.id);
		await addGroupMember(group.id, formerMember.id);
		const preview = await getAccountDeletionPreview(user.id);
		expect(preview.soleAdminGroups[0]?.otherMembers.map((member) => member.id)).toContain(
			formerMember.id,
		);
		await db
			.delete(groupMemberships)
			.where(
				and(eq(groupMemberships.groupId, group.id), eq(groupMemberships.userId, formerMember.id)),
			);

		await expect(
			executeAccountDeletion(user.id, [
				{ action: "transfer", groupId: group.id, newAdminId: formerMember.id },
			]),
		).rejects.toThrow("not a member");
		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, group.id)),
		).toHaveLength(1);
	});

	it("deletes and transfers the user's current sole-admin groups in one transaction", async () => {
		const user = await createTestUser();
		const transferTarget = await createTestUser();
		const deleteGroup = await createTestGroup(user.id, { name: "Delete Me" });
		const transferGroup = await createTestGroup(user.id, { name: "Transfer Me" });
		await addGroupMember(transferGroup.id, transferTarget.id);
		const deletedEvent = await createTestEvent(deleteGroup.id, user.id);
		const transferredEvent = await createTestEvent(transferGroup.id, user.id);
		const transferredRequest = await createTestAvailabilityRequest(transferGroup.id, user.id);

		await executeAccountDeletion(user.id, [
			{ action: "delete", groupId: deleteGroup.id },
			{ action: "transfer", groupId: transferGroup.id, newAdminId: transferTarget.id },
		]);

		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, deleteGroup.id)),
		).toHaveLength(0);
		expect(
			await db.select({ id: events.id }).from(events).where(eq(events.id, deletedEvent.id)),
		).toHaveLength(0);
		const [transferredGroupRow] = await db
			.select({ createdById: groups.createdById })
			.from(groups)
			.where(eq(groups.id, transferGroup.id));
		expect(transferredGroupRow?.createdById).toBe(transferTarget.id);
		const [targetMembership] = await db
			.select({ role: groupMemberships.role })
			.from(groupMemberships)
			.where(
				and(
					eq(groupMemberships.groupId, transferGroup.id),
					eq(groupMemberships.userId, transferTarget.id),
				),
			);
		expect(targetMembership?.role).toBe("admin");
		expect(
			await db
				.select({ id: groupMemberships.id })
				.from(groupMemberships)
				.where(eq(groupMemberships.userId, user.id)),
		).toHaveLength(0);
		const [eventRow] = await db
			.select({ createdById: events.createdById })
			.from(events)
			.where(eq(events.id, transferredEvent.id));
		expect(eventRow?.createdById).toBe(transferTarget.id);
		const [requestRow] = await db
			.select({ createdById: availabilityRequests.createdById })
			.from(availabilityRequests)
			.where(eq(availabilityRequests.id, transferredRequest.id));
		expect(requestRow?.createdById).toBe(transferTarget.id);
		const [userRow] = await db
			.select({ deletedAt: users.deletedAt })
			.from(users)
			.where(eq(users.id, user.id));
		expect(userRow?.deletedAt).toBeInstanceOf(Date);
	});
});
