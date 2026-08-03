import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../src/db/index.js";
import { magicLinkTokens } from "../../../src/db/schema.js";
import {
	consumeLoginMagicLink,
	hashMagicLinkToken,
	issueLoginMagicLink,
} from "../magic-link.server.js";
import { createTestUser } from "./seed.js";
import { cleanDatabase } from "./setup.js";

beforeEach(async () => {
	await cleanDatabase();
});

describe("magic-link service integration", () => {
	it("issues a future-dated token whose exact hash can be consumed", async () => {
		const user = await createTestUser();
		const issued = await issueLoginMagicLink({ userId: user.id });
		const [stored] = await db
			.select({
				tokenHash: magicLinkTokens.tokenHash,
				purpose: magicLinkTokens.purpose,
				redirectPath: magicLinkTokens.redirectPath,
				expiresAt: magicLinkTokens.expiresAt,
				stillValid: sql<boolean>`${magicLinkTokens.expiresAt} > now()`,
			})
			.from(magicLinkTokens)
			.where(eq(magicLinkTokens.userId, user.id));

		expect(stored?.tokenHash).toBe(hashMagicLinkToken(issued.rawToken));
		expect(JSON.stringify(stored)).not.toContain(issued.rawToken);
		expect(stored?.purpose).toBe("login");
		expect(stored?.redirectPath).toBe("/dashboard");
		expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now());
		expect(stored?.stillValid).toBe(true);
		expect(await consumeLoginMagicLink(hashMagicLinkToken(issued.rawToken))).toEqual({
			userId: user.id,
			redirectPath: "/dashboard",
		});
	});

	it("allows exactly one of two simultaneous consumes to succeed", async () => {
		const user = await createTestUser();
		const { rawToken } = await issueLoginMagicLink({ userId: user.id });
		const tokenHash = hashMagicLinkToken(rawToken);

		const results = await Promise.all([
			consumeLoginMagicLink(tokenHash),
			consumeLoginMagicLink(tokenHash),
		]);

		expect(results.filter((result) => result !== null)).toHaveLength(1);
		expect(results.filter((result) => result === null)).toHaveLength(1);
	});

	it("returns the same failure for expired and reused tokens", async () => {
		const user = await createTestUser();
		const expiredRawToken = "a".repeat(43);
		await db.insert(magicLinkTokens).values({
			userId: user.id,
			tokenHash: hashMagicLinkToken(expiredRawToken),
			purpose: "login",
			redirectPath: "/dashboard",
			expiresAt: new Date(Date.now() - 1000),
		});

		const { rawToken } = await issueLoginMagicLink({ userId: user.id });
		const tokenHash = hashMagicLinkToken(rawToken);
		expect(await consumeLoginMagicLink(tokenHash)).not.toBeNull();

		const [expiredResult, reusedResult] = await Promise.all([
			consumeLoginMagicLink(hashMagicLinkToken(expiredRawToken)),
			consumeLoginMagicLink(tokenHash),
		]);
		expect(expiredResult).toBeNull();
		expect(reusedResult).toBeNull();
	});

	it("revokes sibling login tokens after a successful consume", async () => {
		const user = await createTestUser();
		const first = await issueLoginMagicLink({ userId: user.id });
		const second = await issueLoginMagicLink({ userId: user.id });

		expect(await consumeLoginMagicLink(hashMagicLinkToken(first.rawToken))).not.toBeNull();
		expect(await consumeLoginMagicLink(hashMagicLinkToken(second.rawToken))).toBeNull();

		const unconsumed = await db
			.select()
			.from(magicLinkTokens)
			.where(and(eq(magicLinkTokens.userId, user.id), eq(magicLinkTokens.purpose, "login")));
		expect(unconsumed.every((token) => token.consumedAt !== null)).toBe(true);
	});
});
