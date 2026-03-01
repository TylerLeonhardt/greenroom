import crypto from "node:crypto";
import { redirect } from "@remix-run/node";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { db } from "../../src/db/index.js";
import { users } from "../../src/db/schema.js";
import { destroyUserSession, getSession, getUserId, sessionStorage } from "./session.server.js";

type UserRecord = typeof users.$inferSelect;

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	profileImage: string | null;
	timezone: string | null;
}

function toAuthUser(user: UserRecord): AuthUser {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		profileImage: user.profileImage,
		timezone: user.timezone,
	};
}

// --- Authenticator (form strategy) ---

export const authenticator = new Authenticator<AuthUser>();

// Dummy hash for constant-time comparison when user doesn't exist
const DUMMY_HASH = "$2a$12$000000000000000000000uGPOBOBOBOBOBOBOBOBOBOBOBOBOBOBO";

authenticator.use(
	new FormStrategy(async ({ form }) => {
		const email = form.get("email");
		const password = form.get("password");

		if (typeof email !== "string" || typeof password !== "string") {
			throw new Error("Email and password are required.");
		}

		if (!email.trim() || !password.trim()) {
			throw new Error("Email and password are required.");
		}

		const user = await getUserByEmail(email);

		// Always run bcrypt to prevent timing-based user enumeration
		const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
		const isValid = await bcrypt.compare(password, hashToCompare);

		if (!user || !user.passwordHash || !isValid) {
			throw new Error("Invalid email or password.");
		}

		return toAuthUser(user);
	}),
	"form",
);

// --- User DB helpers ---

export async function getUserByEmail(email: string): Promise<UserRecord | undefined> {
	const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
	return result[0];
}

export async function getUserById(id: string): Promise<AuthUser | null> {
	const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
	if (!result[0]) return null;
	// Treat users deleted more than 30 days ago as non-existent
	if (result[0].deletedAt) {
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		if (result[0].deletedAt < thirtyDaysAgo) return null;
	}
	return toAuthUser(result[0]);
}

/**
 * Check if a user is soft-deleted (within 30-day grace period).
 * Returns the deletedAt date if soft-deleted, null otherwise.
 */
export async function getUserDeletedAt(id: string): Promise<Date | null> {
	const result = await db
		.select({ deletedAt: users.deletedAt })
		.from(users)
		.where(eq(users.id, id))
		.limit(1);
	return result[0]?.deletedAt ?? null;
}

/**
 * Reactivate a soft-deleted account by clearing the deletedAt timestamp.
 */
export async function reactivateAccount(userId: string): Promise<void> {
	await db
		.update(users)
		.set({ deletedAt: null, updatedAt: new Date() })
		.where(eq(users.id, userId));
}

export async function getUserByGoogleId(googleId: string): Promise<UserRecord | undefined> {
	const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
	return result[0];
}

// --- Registration ---

export async function registerUser(
	email: string,
	password: string,
	name: string,
): Promise<{ user: AuthUser; isNew: boolean }> {
	const existing = await getUserByEmail(email);
	if (existing) {
		// Don't reveal that the email exists — hash the password anyway for consistent timing
		await bcrypt.hash(password, 12);
		return { user: toAuthUser(existing), isNew: false };
	}

	const passwordHash = await bcrypt.hash(password, 12);
	try {
		const result = await db
			.insert(users)
			.values({
				email: email.toLowerCase().trim(),
				passwordHash,
				name: name.trim(),
				emailVerified: false,
			})
			.returning();

		const user = result[0];
		if (!user) {
			throw new Error("Failed to create user.");
		}

		return { user: toAuthUser(user), isNew: true };
	} catch (error) {
		// Handle race condition: concurrent signup with same email hits unique constraint
		if (error instanceof Error && error.message.includes("unique")) {
			return { user: { id: "", email, name, profileImage: null, timezone: null }, isNew: false };
		}
		throw error;
	}
}

// --- Google OAuth (manual implementation) ---

export async function findOrCreateGoogleUser(profile: {
	googleId: string;
	email: string;
	name: string;
	profileImage: string | null;
}): Promise<AuthUser> {
	// Check if user exists by Google ID
	const existingByGoogle = await getUserByGoogleId(profile.googleId);
	if (existingByGoogle) {
		return toAuthUser(existingByGoogle);
	}

	// Check if user exists by email (link accounts)
	const existingByEmail = await getUserByEmail(profile.email);
	if (existingByEmail) {
		const updated = await db
			.update(users)
			.set({
				googleId: profile.googleId,
				profileImage: profile.profileImage ?? existingByEmail.profileImage,
				emailVerified: true,
				updatedAt: new Date(),
			})
			.where(eq(users.id, existingByEmail.id))
			.returning();
		const user = updated[0];
		if (!user) throw new Error("Failed to link Google account.");
		return toAuthUser(user);
	}

	// Create new user
	const result = await db
		.insert(users)
		.values({
			email: profile.email.toLowerCase().trim(),
			name: profile.name,
			googleId: profile.googleId,
			profileImage: profile.profileImage,
			emailVerified: true,
		})
		.returning();

	const user = result[0];
	if (!user) throw new Error("Failed to create user.");
	return toAuthUser(user);
}

export async function getGoogleAuthURL(request: Request): Promise<{
	url: string;
	headers: Headers;
}> {
	const clientId = process.env.GOOGLE_CLIENT_ID;
	const appUrl = process.env.APP_URL ?? "http://localhost:5173";

	if (!clientId) {
		throw new Error("GOOGLE_CLIENT_ID environment variable is required");
	}

	const state = crypto.randomBytes(32).toString("hex");

	const session = await getSession(request);
	session.set("oauth_state", state);
	const headers = new Headers({
		"Set-Cookie": await sessionStorage.commitSession(session),
	});

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: `${appUrl}/auth/google/callback`,
		response_type: "code",
		scope: "openid email profile",
		access_type: "online",
		prompt: "select_account",
		state,
	});

	return {
		url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
		headers,
	};
}

export async function verifyOAuthState(request: Request, state: string | null): Promise<boolean> {
	if (!state) return false;
	const session = await getSession(request);
	const storedState = session.get("oauth_state");
	if (typeof storedState !== "string") return false;
	try {
		return crypto.timingSafeEqual(Buffer.from(storedState), Buffer.from(state));
	} catch {
		return false;
	}
}

export async function exchangeGoogleCode(code: string): Promise<{
	googleId: string;
	email: string;
	name: string;
	profileImage: string | null;
}> {
	const clientId = process.env.GOOGLE_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
	const appUrl = process.env.APP_URL ?? "http://localhost:5173";

	if (!clientId || !clientSecret) {
		throw new Error("Google OAuth credentials are not configured.");
	}

	// Exchange code for tokens
	const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: `${appUrl}/auth/google/callback`,
			grant_type: "authorization_code",
		}),
	});

	if (!tokenResponse.ok) {
		throw new Error("Failed to exchange Google authorization code.");
	}

	const tokens = (await tokenResponse.json()) as { access_token: string };

	// Fetch user profile
	const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
		headers: { Authorization: `Bearer ${tokens.access_token}` },
	});

	if (!profileResponse.ok) {
		throw new Error("Failed to fetch Google user profile.");
	}

	const profile = (await profileResponse.json()) as {
		sub: string;
		email: string;
		name: string;
		picture?: string;
	};

	return {
		googleId: profile.sub,
		email: profile.email,
		name: profile.name,
		profileImage: profile.picture ?? null,
	};
}

// --- Session helpers ---

export async function requireUser(request: Request): Promise<AuthUser> {
	const userId = await getUserId(request);
	if (!userId) {
		throw redirect("/login");
	}

	// Check if the user is soft-deleted
	const deletedAt = await getUserDeletedAt(userId);
	if (deletedAt) {
		// Destroy session for soft-deleted users
		throw await destroyUserSession(request, "/login");
	}

	const user = await getUserById(userId);
	if (!user) {
		throw redirect("/login");
	}

	return user;
}

export async function getOptionalUser(request: Request): Promise<AuthUser | null> {
	const userId = await getUserId(request);
	if (!userId) return null;
	// Check soft-delete — treat as not logged in
	const deletedAt = await getUserDeletedAt(userId);
	if (deletedAt) return null;
	return getUserById(userId);
}

export async function updateUserTimezone(userId: string, timezone: string): Promise<void> {
	await db.update(users).set({ timezone, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserName(userId: string, name: string): Promise<void> {
	await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
}

// --- Email Verification ---

export async function generateVerificationToken(userId: string): Promise<string> {
	const token = crypto.randomUUID();
	const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
	await db
		.update(users)
		.set({
			emailVerificationToken: token,
			emailVerificationExpiry: expiry,
			updatedAt: new Date(),
		})
		.where(eq(users.id, userId));
	return token;
}

export async function verifyEmailToken(
	token: string,
): Promise<{ success: true; userId: string } | { success: false; reason: string }> {
	const result = await db
		.select()
		.from(users)
		.where(eq(users.emailVerificationToken, token))
		.limit(1);
	const user = result[0];

	if (!user) {
		return { success: false, reason: "Invalid verification link." };
	}

	if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
		return { success: false, reason: "This verification link has expired." };
	}

	await db
		.update(users)
		.set({
			emailVerified: true,
			emailVerificationToken: null,
			emailVerificationExpiry: null,
			updatedAt: new Date(),
		})
		.where(eq(users.id, user.id));

	return { success: true, userId: user.id };
}

export async function isEmailVerified(userId: string): Promise<boolean> {
	const result = await db
		.select({ emailVerified: users.emailVerified })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return result[0]?.emailVerified ?? false;
}

export async function getUserEmailById(userId: string): Promise<string | null> {
	const result = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return result[0]?.email ?? null;
}

export { createUserSession } from "./session.server.js";
