import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import { magicLinkTokens } from "../../src/db/schema.js";

export const MAGIC_LINK_EXPIRY_MINUTES = 10;
export const MAGIC_LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_MAGIC_LINK_EXPIRY_MINUTES = 15;
const DEFAULT_REDIRECT_PATH = "/dashboard";
const URL_SCHEME_PATTERN = /^\/?[a-z][a-z0-9+.-]*:/i;
const DANGEROUS_ENCODED_CHARACTER_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c|3a)/i;

function containsControlCharacter(value: string): boolean {
	return Array.from(value).some((character) => {
		const code = character.charCodeAt(0);
		return code <= 31 || code === 127;
	});
}

function isUnsafeRedirectPath(value: string): boolean {
	return (
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\") ||
		containsControlCharacter(value) ||
		URL_SCHEME_PATTERN.test(value) ||
		DANGEROUS_ENCODED_CHARACTER_PATTERN.test(value)
	);
}

export function generateMagicLinkToken(): string {
	return randomBytes(32).toString("base64url");
}

export function hashMagicLinkToken(rawToken: string): string {
	return createHash("sha256").update(rawToken).digest("hex");
}

export function isValidMagicLinkToken(rawToken: string): boolean {
	return MAGIC_LINK_TOKEN_PATTERN.test(rawToken);
}

export function validateMagicLinkRedirectPath(value: string | null | undefined): string {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 500 ||
		isUnsafeRedirectPath(value)
	) {
		return DEFAULT_REDIRECT_PATH;
	}

	let decoded = value;
	try {
		for (let i = 0; i < 5; i++) {
			const next = decodeURIComponent(decoded);
			if (next === decoded) return value;
			decoded = next;
			if (isUnsafeRedirectPath(decoded)) return DEFAULT_REDIRECT_PATH;
		}
	} catch {
		return DEFAULT_REDIRECT_PATH;
	}

	// Reject unusually deep encoding rather than risk a downstream decoder exposing a dangerous path.
	return DEFAULT_REDIRECT_PATH;
}

export async function issueLoginMagicLink(options: {
	userId: string;
	redirectPath?: string | null;
	expiryMinutes?: number;
}): Promise<{ rawToken: string; expiresAt: Date }> {
	const expiryMinutes = options.expiryMinutes ?? MAGIC_LINK_EXPIRY_MINUTES;
	if (
		!Number.isInteger(expiryMinutes) ||
		expiryMinutes < 1 ||
		expiryMinutes > MAX_MAGIC_LINK_EXPIRY_MINUTES
	) {
		throw new RangeError("Magic-link expiry must be between 1 and 15 minutes.");
	}

	const rawToken = generateMagicLinkToken();
	const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

	await db.insert(magicLinkTokens).values({
		userId: options.userId,
		tokenHash: hashMagicLinkToken(rawToken),
		purpose: "login",
		redirectPath: validateMagicLinkRedirectPath(options.redirectPath),
		expiresAt,
	});

	return { rawToken, expiresAt };
}

export async function consumeLoginMagicLink(tokenHash: string): Promise<{
	userId: string;
	redirectPath: string;
} | null> {
	return db.transaction(async (tx) => {
		const [consumed] = await tx
			.update(magicLinkTokens)
			.set({ consumedAt: sql`now()` })
			.where(
				and(
					eq(magicLinkTokens.tokenHash, tokenHash),
					eq(magicLinkTokens.purpose, "login"),
					isNull(magicLinkTokens.consumedAt),
					gt(magicLinkTokens.expiresAt, sql`now()`),
				),
			)
			.returning({
				id: magicLinkTokens.id,
				userId: magicLinkTokens.userId,
				redirectPath: magicLinkTokens.redirectPath,
			});

		if (!consumed) return null;

		await tx
			.update(magicLinkTokens)
			.set({ consumedAt: sql`now()` })
			.where(
				and(
					eq(magicLinkTokens.userId, consumed.userId),
					eq(magicLinkTokens.purpose, "login"),
					isNull(magicLinkTokens.consumedAt),
					ne(magicLinkTokens.id, consumed.id),
				),
			);

		return {
			userId: consumed.userId,
			redirectPath: validateMagicLinkRedirectPath(consumed.redirectPath),
		};
	});
}

export async function cleanupExpiredMagicLinks(): Promise<number> {
	const deleted = await db
		.delete(magicLinkTokens)
		.where(lt(magicLinkTokens.expiresAt, sql`now()`))
		.returning({ id: magicLinkTokens.id });
	return deleted.length;
}
