import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import { calendarTokens, users } from "../../src/db/schema.js";

export async function createCalendarToken(userId: string): Promise<string> {
	const token = crypto.randomBytes(32).toString("hex");
	await db.insert(calendarTokens).values({ userId, token });
	return token;
}

export async function getCalendarToken(userId: string): Promise<string | null> {
	const [row] = await db
		.select({ token: calendarTokens.token })
		.from(calendarTokens)
		.where(eq(calendarTokens.userId, userId))
		.limit(1);
	return row?.token ?? null;
}

export async function regenerateCalendarToken(userId: string): Promise<string> {
	const token = crypto.randomBytes(32).toString("hex");
	const [existing] = await db
		.select({ id: calendarTokens.id })
		.from(calendarTokens)
		.where(eq(calendarTokens.userId, userId))
		.limit(1);

	if (existing) {
		await db
			.update(calendarTokens)
			.set({ token, createdAt: new Date() })
			.where(eq(calendarTokens.userId, userId));
	} else {
		await db.insert(calendarTokens).values({ userId, token });
	}

	return token;
}

export async function getUserByCalendarToken(
	token: string,
): Promise<{ id: string; timezone: string | null } | null> {
	const [row] = await db
		.select({
			id: users.id,
			timezone: users.timezone,
		})
		.from(calendarTokens)
		.innerJoin(users, eq(calendarTokens.userId, users.id))
		.where(eq(calendarTokens.token, token))
		.limit(1);

	if (!row) return null;

	// Check if user is soft-deleted
	const [userRow] = await db
		.select({ deletedAt: users.deletedAt })
		.from(users)
		.where(eq(users.id, row.id))
		.limit(1);

	if (userRow?.deletedAt) return null;

	return row;
}
