import crypto from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import { groupMemberships, groups, users } from "../../src/db/schema.js";
import { requireUser } from "./auth.server.js";

type Group = typeof groups.$inferSelect;

// --- Invite Code ---

export function generateInviteCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
	let code = "";
	for (let i = 0; i < 8; i++) {
		code += chars[crypto.randomInt(chars.length)];
	}
	return code;
}

// --- Group CRUD ---

export async function createGroup(
	userId: string,
	data: { name: string; description?: string },
): Promise<Group> {
	// Retry invite code generation on collision (up to 5 attempts)
	for (let attempt = 0; attempt < 5; attempt++) {
		const inviteCode = generateInviteCode();
		try {
			const result = await db.transaction(async (tx) => {
				const [group] = await tx
					.insert(groups)
					.values({
						name: data.name.trim(),
						description: data.description?.trim() || null,
						inviteCode,
						createdById: userId,
					})
					.returning();
				if (!group) throw new Error("Failed to create group.");

				await tx.insert(groupMemberships).values({
					groupId: group.id,
					userId,
					role: "admin",
				});

				return group;
			});
			return result;
		} catch (error) {
			// If unique constraint violation on invite_code, retry
			const message = error instanceof Error ? error.message : "";
			if (message.includes("invite_code") && attempt < 4) continue;
			throw error;
		}
	}
	throw new Error("Failed to generate unique invite code.");
}

export async function getUserGroups(
	userId: string,
): Promise<Array<Group & { role: string; memberCount: number }>> {
	const rows = await db
		.select({
			id: groups.id,
			name: groups.name,
			description: groups.description,
			inviteCode: groups.inviteCode,
			createdById: groups.createdById,
			createdAt: groups.createdAt,
			updatedAt: groups.updatedAt,
			role: groupMemberships.role,
			memberCount: sql<number>`cast(count(*) over (partition by ${groups.id}) as int)`,
		})
		.from(groupMemberships)
		.innerJoin(groups, eq(groupMemberships.groupId, groups.id))
		.where(eq(groupMemberships.userId, userId))
		.orderBy(groups.name);

	return rows;
}

export async function getGroupById(groupId: string): Promise<Group | null> {
	const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
	return group ?? null;
}

export async function getGroupWithMembers(groupId: string): Promise<{
	group: Group;
	members: Array<{
		id: string;
		name: string;
		email: string;
		profileImage: string | null;
		role: string;
		joinedAt: Date;
	}>;
} | null> {
	const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
	if (!group) return null;

	const members = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			profileImage: users.profileImage,
			role: groupMemberships.role,
			joinedAt: groupMemberships.joinedAt,
		})
		.from(groupMemberships)
		.innerJoin(users, eq(groupMemberships.userId, users.id))
		.where(eq(groupMemberships.groupId, groupId))
		.orderBy(groupMemberships.role, users.name);

	return { group, members };
}

// --- Join / Membership ---

export async function joinGroup(
	userId: string,
	inviteCode: string,
): Promise<{ success: boolean; groupId?: string; error?: string }> {
	const code = inviteCode.trim().toUpperCase();
	const [group] = await db.select().from(groups).where(eq(groups.inviteCode, code)).limit(1);

	if (!group) {
		return { success: false, error: "Invalid invite code." };
	}

	// Check if already a member
	const [existing] = await db
		.select()
		.from(groupMemberships)
		.where(and(eq(groupMemberships.groupId, group.id), eq(groupMemberships.userId, userId)))
		.limit(1);

	if (existing) {
		return { success: false, error: "You're already a member of this group.", groupId: group.id };
	}

	await db.insert(groupMemberships).values({
		groupId: group.id,
		userId,
		role: "member",
	});

	return { success: true, groupId: group.id };
}

export async function isGroupMember(userId: string, groupId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: groupMemberships.id })
		.from(groupMemberships)
		.where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)))
		.limit(1);
	return !!row;
}

export async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
	const [row] = await db
		.select({ role: groupMemberships.role })
		.from(groupMemberships)
		.where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)))
		.limit(1);
	return row?.role === "admin";
}

export async function getUserRole(userId: string, groupId: string): Promise<string | null> {
	const [row] = await db
		.select({ role: groupMemberships.role })
		.from(groupMemberships)
		.where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)))
		.limit(1);
	return row?.role ?? null;
}

// --- Admin Operations ---

export async function removeMember(groupId: string, userId: string): Promise<void> {
	// Check if user is the only admin
	const [memberRow] = await db
		.select({ role: groupMemberships.role })
		.from(groupMemberships)
		.where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)))
		.limit(1);

	if (!memberRow) throw new Error("User is not a member of this group.");

	if (memberRow.role === "admin") {
		const [adminCount] = await db
			.select({ count: count() })
			.from(groupMemberships)
			.where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.role, "admin")));
		if (adminCount && adminCount.count <= 1) {
			throw new Error("Cannot remove the only admin.");
		}
	}

	await db
		.delete(groupMemberships)
		.where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)));
}

export async function updateGroup(
	groupId: string,
	data: { name?: string; description?: string },
): Promise<Group> {
	const [updated] = await db
		.update(groups)
		.set({
			...(data.name !== undefined ? { name: data.name.trim() } : {}),
			...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
			updatedAt: new Date(),
		})
		.where(eq(groups.id, groupId))
		.returning();
	if (!updated) throw new Error("Group not found.");
	return updated;
}

export async function regenerateInviteCode(groupId: string): Promise<string> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = generateInviteCode();
		try {
			const [updated] = await db
				.update(groups)
				.set({ inviteCode: code, updatedAt: new Date() })
				.where(eq(groups.id, groupId))
				.returning();
			if (!updated) throw new Error("Group not found.");
			return code;
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (message.includes("invite_code") && attempt < 4) continue;
			throw error;
		}
	}
	throw new Error("Failed to generate unique invite code.");
}

// --- Route Helpers ---

export async function requireGroupMember(request: Request, groupId: string) {
	const user = await requireUser(request);
	const member = await isGroupMember(user.id, groupId);
	if (!member) throw new Response("Not Found", { status: 404 });
	return user;
}

export async function requireGroupAdmin(request: Request, groupId: string) {
	const user = await requireUser(request);
	const admin = await isGroupAdmin(user.id, groupId);
	if (!admin) throw new Response("Forbidden", { status: 403 });
	return user;
}
