import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../../src/db/index.js";
import { users } from "../../../src/db/schema.js";
import { createTestUser } from "../../services/__integration__/seed.js";
import { cleanDatabase } from "../../services/__integration__/setup.js";
import { getUserId, sessionStorage } from "../../services/session.server.js";
import { loader } from "../auth.google.callback.js";

const OAUTH_STATE = "test-oauth-state";

async function oauthStateCookie(): Promise<string> {
	const session = await sessionStorage.getSession();
	session.set("oauth_state", OAUTH_STATE);
	return sessionStorage.commitSession(session);
}

function mockGoogleUserInfo(userInfo: unknown): void {
	vi.stubGlobal(
		"fetch",
		vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({ access_token: "google-access-token" }, { status: 200 }),
			)
			.mockResolvedValueOnce(Response.json(userInfo, { status: 200 })),
	);
}

async function runCallback(): Promise<Response> {
	const cookie = await oauthStateCookie();
	return loader({
		request: new Request(
			`http://localhost/auth/google/callback?code=test-code&state=${OAUTH_STATE}`,
			{ headers: { Cookie: cookie } },
		),
		params: {},
		context: {},
	});
}

async function expectNoAuthenticatedSession(response: Response): Promise<void> {
	expect(response.status).toBe(302);
	expect(response.headers.get("Location")).toBe("/login");
	expect(response.headers.get("Set-Cookie")).toBeNull();
	expect(await getUserId(new Request("http://localhost/dashboard"))).toBeUndefined();
}

beforeEach(async () => {
	await cleanDatabase();
	vi.stubEnv("GOOGLE_CLIENT_ID", "test-google-client-id");
	vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-google-client-secret");
	vi.stubEnv("APP_URL", "http://localhost");
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("Google OAuth callback integration", () => {
	it.each([
		["false", false],
		["missing", undefined],
		["null", null],
		["string", "true"],
		["number", 1],
	])("rejects an %s email_verified claim without creating, linking, or signing in", async (_label, emailVerified) => {
		const victim = await createTestUser({
			email: "victim@example.com",
			googleId: null,
			profileImage: "https://example.com/original.png",
			emailVerified: false,
		});
		const userInfo: Record<string, unknown> = {
			sub: "attacker-google-id",
			email: "victim@example.com",
			name: "Attacker",
			picture: "https://example.com/attacker.png",
		};
		if (emailVerified !== undefined) userInfo.email_verified = emailVerified;
		mockGoogleUserInfo(userInfo);

		const response = await runCallback();

		await expectNoAuthenticatedSession(response);
		const allUsers = await db.select().from(users);
		expect(allUsers).toHaveLength(1);
		expect(allUsers[0]).toEqual(victim);
	});

	it.each([
		["sub", { email: "victim@example.com" }],
		["email", { sub: "attacker-google-id" }],
	])("rejects userinfo missing %s without mutating or signing in", async (_field, claims) => {
		const victim = await createTestUser({
			email: "victim@example.com",
			googleId: null,
			emailVerified: false,
		});
		mockGoogleUserInfo({
			...claims,
			name: "Attacker",
			email_verified: true,
		});

		const response = await runCallback();

		await expectNoAuthenticatedSession(response);
		const allUsers = await db.select().from(users);
		expect(allUsers).toHaveLength(1);
		expect(allUsers[0]).toEqual(victim);
	});

	it("rejects replacing an existing Google subject without mutating or signing in", async () => {
		const victim = await createTestUser({
			email: "victim@example.com",
			googleId: "original-google-id",
			profileImage: "https://example.com/original.png",
			emailVerified: true,
		});
		mockGoogleUserInfo({
			sub: "replacement-google-id",
			email: "victim@example.com",
			email_verified: true,
			name: "Replacement User",
			picture: "https://example.com/replacement.png",
		});

		const response = await runCallback();

		await expectNoAuthenticatedSession(response);
		const allUsers = await db.select().from(users);
		expect(allUsers).toHaveLength(1);
		expect(allUsers[0]).toEqual(victim);
	});

	it("links a verified Google identity using the normalized email and signs in", async () => {
		const existing = await createTestUser({
			email: "verified@example.com",
			googleId: null,
			emailVerified: false,
		});
		mockGoogleUserInfo({
			sub: "verified-google-id",
			email: "  VERIFIED@EXAMPLE.COM ",
			email_verified: true,
			name: "Verified User",
			picture: "https://example.com/verified.png",
		});

		const response = await runCallback();

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/dashboard");
		const authCookie = response.headers.get("Set-Cookie");
		expect(authCookie).not.toBeNull();
		expect(
			await getUserId(
				new Request("http://localhost/dashboard", { headers: { Cookie: authCookie ?? "" } }),
			),
		).toBe(existing.id);
		const [linked] = await db.select().from(users).where(eq(users.id, existing.id));
		expect(linked).toMatchObject({
			email: "verified@example.com",
			googleId: "verified-google-id",
			profileImage: "https://example.com/verified.png",
			emailVerified: true,
		});
	});

	it("creates a verified Google user with a normalized email and signs in", async () => {
		mockGoogleUserInfo({
			sub: "new-google-id",
			email: "  NEW.USER@EXAMPLE.COM ",
			email_verified: true,
			name: "New User",
		});

		const response = await runCallback();

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/dashboard");
		const authCookie = response.headers.get("Set-Cookie");
		expect(authCookie).not.toBeNull();
		const [created] = await db.select().from(users);
		expect(created).toMatchObject({
			email: "new.user@example.com",
			name: "New User",
			googleId: "new-google-id",
			profileImage: null,
			emailVerified: true,
		});
		expect(
			await getUserId(
				new Request("http://localhost/dashboard", { headers: { Cookie: authCookie ?? "" } }),
			),
		).toBe(created?.id);
	});
});
