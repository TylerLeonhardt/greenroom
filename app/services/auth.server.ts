import crypto from "node:crypto";
import { redirect } from "@remix-run/node";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { db } from "../../src/db/index.js";
import { users } from "../../src/db/schema.js";
import { getSession, getUserId, sessionStorage } from "./session.server.js";

type UserRecord = typeof users.$inferSelect;

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	profileImage: string | null;
}

function toAuthUser(user: UserRecord): AuthUser {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		profileImage: user.profileImage,
	};
}

// --- Authenticator (form strategy) ---

export const authenticator = new Authenticator<AuthUser>();

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
		if (!user) {
			throw new Error("Invalid email or password.");
		}

		if (!user.passwordHash) {
			throw new Error("This account uses Google sign-in. Please sign in with Google.");
		}

		const isValid = await bcrypt.compare(password, user.passwordHash);
		if (!isValid) {
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
	return toAuthUser(result[0]);
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
): Promise<AuthUser> {
	const existing = await getUserByEmail(email);
	if (existing) {
		throw new Error("An account with this email already exists.");
	}

	const passwordHash = await bcrypt.hash(password, 12);
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

	return toAuthUser(user);
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

	const user = await getUserById(userId);
	if (!user) {
		throw redirect("/login");
	}

	return user;
}

export async function getOptionalUser(request: Request): Promise<AuthUser | null> {
	const userId = await getUserId(request);
	if (!userId) return null;
	return getUserById(userId);
}

export { createUserSession } from "./session.server.js";
