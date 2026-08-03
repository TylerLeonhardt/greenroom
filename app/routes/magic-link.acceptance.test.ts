import { beforeEach, describe, expect, it, vi } from "vitest";

const acceptance = vi.hoisted(() => ({
	rawToken: "acceptance-token-value".padEnd(43, "a"),
	consumed: false,
}));

vi.mock("~/services/auth-timing.server", () => ({
	performDummyHashComparison: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("~/services/auth.server", () => ({
	getUserByEmail: vi.fn().mockResolvedValue({
		id: "passwordless-user",
		email: "passwordless@example.com",
		name: "Passwordless User",
		passwordHash: null,
		emailVerified: true,
		deletedAt: null,
	}),
}));
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("~/services/email.server", () => ({
	sendMagicLinkEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("~/services/logger.server", () => ({
	logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("~/services/magic-link.server", () => ({
	issueLoginMagicLink: vi.fn().mockResolvedValue({
		rawToken: acceptance.rawToken,
		expiresAt: new Date(Date.now() + 600_000),
	}),
	validateMagicLinkRedirectPath: vi.fn((value: string | null) => value ?? "/dashboard"),
	isValidMagicLinkToken: vi.fn((token: string) => /^[A-Za-z0-9_-]{43}$/.test(token)),
	hashMagicLinkToken: vi.fn((token: string) => `hash:${token}`),
	consumeLoginMagicLink: vi.fn().mockImplementation(async () => {
		if (acceptance.consumed) return null;
		acceptance.consumed = true;
		return { userId: "passwordless-user", redirectPath: "/dashboard" };
	}),
}));
vi.mock("~/services/rate-limit.server", () => ({
	checkLoginRateLimit: vi.fn().mockReturnValue({ limited: false }),
	checkRateLimit: vi.fn().mockReturnValue({ limited: false }),
	getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("~/services/session.server", () => ({
	createUserSession: vi.fn().mockImplementation((userId: string, redirectPath: string) => {
		return new Response(null, {
			status: 302,
			headers: {
				Location: redirectPath,
				"Set-Cookie": `__greenroom_session=${userId}`,
			},
		});
	}),
}));

import { action as consumeAction } from "~/routes/auth.magic-link.consume";
import { action as requestAction } from "~/routes/auth.magic-link.request";
import { sendMagicLinkEmail } from "~/services/email.server";
import { magicLinkHandoffCookie } from "~/services/magic-link-handoff.server";
import { createUserSession } from "~/services/session.server";

describe("passwordless magic-link acceptance", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		acceptance.consumed = false;
	});

	it("requests a link and authenticates a user without a password", async () => {
		const requestResponse = await requestAction({
			request: new Request("http://localhost/auth/magic-link/request", {
				method: "POST",
				body: new URLSearchParams({ email: "passwordless@example.com" }),
			}),
			params: {},
			context: {},
		});
		expect(requestResponse).toMatchObject({ success: true });

		const sentEmail = (sendMagicLinkEmail as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
		expect(sentEmail.magicLinkUrl).toContain(acceptance.rawToken);

		const handoff = await magicLinkHandoffCookie.serialize(acceptance.rawToken);
		const consumeResponse = await consumeAction({
			request: new Request("http://localhost/auth/magic-link/consume", {
				method: "POST",
				body: new URLSearchParams({ _csrf: "test" }),
				headers: { Cookie: handoff.split(";")[0] },
			}),
			params: {},
			context: {},
		});

		expect(consumeResponse.status).toBe(302);
		expect(consumeResponse.headers.get("Location")).toBe("/dashboard");
		expect(createUserSession).toHaveBeenCalledWith("passwordless-user", "/dashboard");
		expect(createUserSession).toHaveBeenCalledTimes(1);
	});
});
