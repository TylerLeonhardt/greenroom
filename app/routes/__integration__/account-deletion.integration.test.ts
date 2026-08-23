import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../src/db/index.js";
import { events, groups, users } from "../../../src/db/schema.js";
import {
	createTestEvent,
	createTestGroup,
	createTestUser,
} from "../../services/__integration__/seed.js";
import { cleanDatabase } from "../../services/__integration__/setup.js";
import { generateCsrfToken } from "../../services/csrf.server.js";
import { createUserSession } from "../../services/session.server.js";
import { action } from "../settings_.delete-account.js";

beforeEach(async () => {
	await cleanDatabase();
});

async function submit(userId: string, email: string, decisions: unknown) {
	const path = "/settings/delete-account";
	const loginResponse = await createUserSession(userId, path);
	const authCookie = loginResponse.headers.get("Set-Cookie");
	if (!authCookie) throw new Error("Expected authenticated session cookie");

	const csrfRequest = new Request(`http://localhost${path}`, {
		headers: { Cookie: authCookie.split(";")[0] },
	});
	const { token, cookie } = await generateCsrfToken(csrfRequest);
	const request = new Request(`http://localhost${path}`, {
		method: "POST",
		body: new URLSearchParams({
			_csrf: token,
			intent: "delete-account",
			confirmEmail: email,
			decisions: JSON.stringify(decisions),
		}),
		headers: { Cookie: cookie.split(";")[0] },
	});

	return action({ request, params: {}, context: {} });
}

describe("account deletion route integration", () => {
	it("rejects a foreign group delete and preserves the group and its cascading data", async () => {
		const attacker = await createTestUser();
		const victim = await createTestUser();
		const attackerGroup = await createTestGroup(attacker.id);
		const victimGroup = await createTestGroup(victim.id);
		const victimEvent = await createTestEvent(victimGroup.id, victim.id);

		const result = await submit(attacker.id, attacker.email, [
			{ action: "delete", groupId: attackerGroup.id },
			{ action: "delete", groupId: victimGroup.id },
		]);

		expect(result).toEqual({ error: "Invalid group decisions." });
		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, attackerGroup.id)),
		).toHaveLength(1);
		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, victimGroup.id)),
		).toHaveLength(1);
		expect(
			await db.select({ id: events.id }).from(events).where(eq(events.id, victimEvent.id)),
		).toHaveLength(1);
		const [attackerRow] = await db
			.select({ deletedAt: users.deletedAt })
			.from(users)
			.where(eq(users.id, attacker.id));
		expect(attackerRow?.deletedAt).toBeNull();
	});

	it("rejects duplicate decisions", async () => {
		const user = await createTestUser();
		const group = await createTestGroup(user.id);

		const result = await submit(user.id, user.email, [
			{ action: "delete", groupId: group.id },
			{ action: "delete", groupId: group.id },
		]);

		expect(result).toEqual({ error: "Invalid group decisions." });
		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, group.id)),
		).toHaveLength(1);
	});

	it.each([
		[{ action: "archive", groupId: "not-allowed" }],
		[{ action: "delete" }],
		[{ action: "delete", groupId: "not-allowed", unexpected: true }],
	])("rejects malformed decisions: %j", async (decisions) => {
		const user = await createTestUser();

		const result = await submit(user.id, user.email, decisions);

		expect(result).toEqual({ error: "Invalid group decisions." });
	});

	it("rejects a transfer target who is not a group member", async () => {
		const user = await createTestUser();
		const outsider = await createTestUser();
		const group = await createTestGroup(user.id);

		const result = await submit(user.id, user.email, [
			{ action: "transfer", groupId: group.id, newAdminId: outsider.id },
		]);

		expect(result).toEqual({
			error: "Selected transfer target is not a member of the group.",
		});
		expect(
			await db.select({ id: groups.id }).from(groups).where(eq(groups.id, group.id)),
		).toHaveLength(1);
	});
});
