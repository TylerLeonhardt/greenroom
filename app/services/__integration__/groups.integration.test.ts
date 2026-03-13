/**
 * Integration tests for app/services/groups.server.ts
 *
 * These tests run against a real PostgreSQL database (greenroom_test).
 * Prerequisites: Docker Compose Postgres running on port 5432.
 * Run with: pnpm test:integration
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../src/db/index.js";
import { events, groupMemberships } from "../../../src/db/schema.js";
import {
	createGroup,
	deleteGroup,
	getGroupById,
	getGroupWithMembers,
	getUserGroups,
	getUserRole,
	isGroupAdmin,
	isGroupMember,
	joinGroup,
	regenerateInviteCode,
	removeMember,
	updateGroup,
	updateGroupPermissions,
} from "../groups.server.js";
import { addGroupMember, createTestEvent, createTestGroup, createTestUser } from "./seed.js";
import { cleanDatabase } from "./setup.js";

beforeEach(async () => {
	await cleanDatabase();
});

describe("groups.server integration", () => {
	// --- createGroup ---

	describe("createGroup", () => {
		it("creates group with admin membership in a single transaction", async () => {
			const user = await createTestUser({ name: "Group Creator" });

			const group = await createGroup(user.id, {
				name: "  My Improv Team  ",
				description: "  We do improv  ",
			});

			expect(group.id).toBeDefined();
			expect(group.name).toBe("My Improv Team"); // trimmed
			expect(group.description).toBe("We do improv"); // trimmed
			expect(group.createdById).toBe(user.id);
			expect(group.inviteCode).toHaveLength(8);
			expect(group.membersCanCreateRequests).toBe(false); // default
			expect(group.membersCanCreateEvents).toBe(false); // default

			// Verify creator is admin
			const isAdmin = await isGroupAdmin(user.id, group.id);
			expect(isAdmin).toBe(true);
		});

		it("generates unique invite codes", async () => {
			const user = await createTestUser();
			const codes = new Set<string>();

			for (let i = 0; i < 5; i++) {
				const group = await createGroup(user.id, { name: `Group ${i}` });
				codes.add(group.inviteCode);
			}

			expect(codes.size).toBe(5); // all unique
		});

		it("invite code uses only allowed characters", async () => {
			const user = await createTestUser();
			const group = await createGroup(user.id, { name: "Test" });

			const allowed = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
			expect(group.inviteCode).toMatch(allowed);
		});

		it("sets description to null when empty", async () => {
			const user = await createTestUser();
			const group = await createGroup(user.id, { name: "No Desc", description: "  " });

			// Re-fetch to confirm DB value
			const fetched = await getGroupById(group.id);
			expect(fetched?.description).toBeNull();
		});
	});

	// --- joinGroup ---

	describe("joinGroup", () => {
		it("joins a group via invite code", async () => {
			const admin = await createTestUser({ name: "Admin" });
			const group = await createTestGroup(admin.id);
			const newMember = await createTestUser({ name: "New Member" });

			const result = await joinGroup(newMember.id, group.inviteCode);

			expect(result.success).toBe(true);
			expect(result.groupId).toBe(group.id);

			const isMember = await isGroupMember(newMember.id, group.id);
			expect(isMember).toBe(true);

			// Should be a member, not admin
			const role = await getUserRole(newMember.id, group.id);
			expect(role).toBe("member");
		});

		it("handles case-insensitive invite codes", async () => {
			const admin = await createTestUser();
			const group = await createTestGroup(admin.id);
			const member = await createTestUser();

			const result = await joinGroup(member.id, group.inviteCode.toLowerCase());
			expect(result.success).toBe(true);
		});

		it("returns error for invalid invite code", async () => {
			const user = await createTestUser();

			const result = await joinGroup(user.id, "ZZZZZZZZ");
			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid invite code.");
		});

		it("returns error when already a member", async () => {
			const admin = await createTestUser();
			const group = await createTestGroup(admin.id);

			const result = await joinGroup(admin.id, group.inviteCode);
			expect(result.success).toBe(false);
			expect(result.error).toContain("already a member");
			expect(result.groupId).toBe(group.id);
		});
	});

	// --- Membership queries ---

	describe("isGroupMember / isGroupAdmin / getUserRole", () => {
		it("returns correct membership and role status", async () => {
			const admin = await createTestUser({ name: "Admin" });
			const member = await createTestUser({ name: "Member" });
			const nonMember = await createTestUser({ name: "Outsider" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);

			// Admin
			expect(await isGroupMember(admin.id, group.id)).toBe(true);
			expect(await isGroupAdmin(admin.id, group.id)).toBe(true);
			expect(await getUserRole(admin.id, group.id)).toBe("admin");

			// Member
			expect(await isGroupMember(member.id, group.id)).toBe(true);
			expect(await isGroupAdmin(member.id, group.id)).toBe(false);
			expect(await getUserRole(member.id, group.id)).toBe("member");

			// Non-member
			expect(await isGroupMember(nonMember.id, group.id)).toBe(false);
			expect(await isGroupAdmin(nonMember.id, group.id)).toBe(false);
			expect(await getUserRole(nonMember.id, group.id)).toBeNull();
		});
	});

	// --- getUserGroups ---

	describe("getUserGroups", () => {
		it("returns all groups a user belongs to with member counts", async () => {
			const user = await createTestUser();
			const other = await createTestUser();
			const _g1 = await createTestGroup(user.id, { name: "Alpha" });
			const g2 = await createTestGroup(other.id, { name: "Beta" });
			await addGroupMember(g2.id, user.id);

			const myGroups = await getUserGroups(user.id);
			expect(myGroups).toHaveLength(2);

			// Sorted by name
			expect(myGroups[0].name).toBe("Alpha");
			expect(myGroups[0].role).toBe("admin");
			expect(myGroups[0].memberCount).toBe(1);

			expect(myGroups[1].name).toBe("Beta");
			expect(myGroups[1].role).toBe("member");
			expect(myGroups[1].memberCount).toBe(2); // other (admin) + user (member)
		});

		it("returns empty array for user with no groups", async () => {
			const user = await createTestUser();
			const result = await getUserGroups(user.id);
			expect(result).toEqual([]);
		});
	});

	// --- getGroupWithMembers ---

	describe("getGroupWithMembers", () => {
		it("returns group with all members sorted by role then name", async () => {
			const admin = await createTestUser({ name: "Zara Admin" });
			const m1 = await createTestUser({ name: "Alice" });
			const m2 = await createTestUser({ name: "Bob" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, m1.id);
			await addGroupMember(group.id, m2.id);

			const result = await getGroupWithMembers(group.id);
			expect(result).not.toBeNull();
			expect(result?.group.name).toBe("Test Group");
			expect(result?.members).toHaveLength(3);

			// admin role sorts before member
			expect(result?.members[0].role).toBe("admin");
			expect(result?.members[0].name).toBe("Zara Admin");
		});

		it("returns null for non-existent group", async () => {
			const result = await getGroupWithMembers("00000000-0000-0000-0000-000000000000");
			expect(result).toBeNull();
		});
	});

	// --- updateGroup ---

	describe("updateGroup", () => {
		it("updates name and description", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id, { name: "Old Name" });

			const updated = await updateGroup(group.id, {
				name: "  New Name  ",
				description: "New desc",
			});

			expect(updated.name).toBe("New Name");
			expect(updated.description).toBe("New desc");
		});

		it("can set webhookUrl", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const updated = await updateGroup(group.id, {
				webhookUrl: "https://discord.com/api/webhooks/123/abc",
			});
			expect(updated.webhookUrl).toBe("https://discord.com/api/webhooks/123/abc");

			// Can clear it
			const cleared = await updateGroup(group.id, { webhookUrl: null });
			expect(cleared.webhookUrl).toBeNull();
		});
	});

	// --- updateGroupPermissions ---

	describe("updateGroupPermissions", () => {
		it("toggles member permission flags", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			expect(group.membersCanCreateRequests).toBe(false);
			expect(group.membersCanCreateEvents).toBe(false);

			const updated = await updateGroupPermissions(group.id, {
				membersCanCreateRequests: true,
				membersCanCreateEvents: true,
			});
			expect(updated.membersCanCreateRequests).toBe(true);
			expect(updated.membersCanCreateEvents).toBe(true);

			const reverted = await updateGroupPermissions(group.id, {
				membersCanCreateRequests: false,
			});
			expect(reverted.membersCanCreateRequests).toBe(false);
			expect(reverted.membersCanCreateEvents).toBe(true); // unchanged
		});
	});

	// --- regenerateInviteCode ---

	describe("regenerateInviteCode", () => {
		it("generates a new code different from the old one", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const oldCode = group.inviteCode;

			const newCode = await regenerateInviteCode(group.id);

			expect(newCode).toHaveLength(8);
			// Extremely unlikely to be the same (1 in 32^8 ≈ 1 trillion)
			expect(newCode).not.toBe(oldCode);

			// Verify in DB
			const fetched = await getGroupById(group.id);
			expect(fetched?.inviteCode).toBe(newCode);
		});
	});

	// --- removeMember ---

	describe("removeMember", () => {
		it("removes a member from the group", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);

			await removeMember(group.id, member.id);

			expect(await isGroupMember(member.id, group.id)).toBe(false);
		});

		it("throws when trying to remove the only admin", async () => {
			const admin = await createTestUser();
			const group = await createTestGroup(admin.id);

			await expect(removeMember(group.id, admin.id)).rejects.toThrow(
				"Cannot remove the only admin.",
			);
		});

		it("throws when user is not a member", async () => {
			const admin = await createTestUser();
			const nonMember = await createTestUser();
			const group = await createTestGroup(admin.id);

			await expect(removeMember(group.id, nonMember.id)).rejects.toThrow(
				"User is not a member of this group.",
			);
		});
	});

	// --- deleteGroup ---

	describe("deleteGroup", () => {
		it("deletes group and cascades to memberships and events", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);
			const _event = await createTestEvent(group.id, admin.id);

			await deleteGroup(group.id);

			// Group gone
			expect(await getGroupById(group.id)).toBeNull();

			// Memberships gone
			const memberships = await db
				.select()
				.from(groupMemberships)
				.where(eq(groupMemberships.groupId, group.id));
			expect(memberships).toHaveLength(0);

			// Events gone
			const remainingEvents = await db.select().from(events).where(eq(events.groupId, group.id));
			expect(remainingEvents).toHaveLength(0);
		});
	});
});
