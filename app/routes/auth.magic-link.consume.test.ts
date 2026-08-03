import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("~/services/magic-link.server", () => ({
	consumeLoginMagicLink: vi.fn(),
	hashMagicLinkToken: vi.fn((token: string) => `hash:${token}`),
	isValidMagicLinkToken: vi.fn((token: string) => /^[A-Za-z0-9_-]{43}$/.test(token)),
}));
vi.mock("~/services/session.server", () => ({
	createUserSession: vi.fn().mockImplementation((_userId: string, redirectPath: string) => {
		return new Response(null, {
			status: 302,
			headers: { Location: redirectPath, "Set-Cookie": "__greenroom_session=fresh" },
		});
	}),
}));

import { action, loader } from "~/routes/auth.magic-link.consume";
import { validateCsrfToken } from "~/services/csrf.server";
import { consumeLoginMagicLink } from "~/services/magic-link.server";
import { magicLinkHandoffCookie } from "~/services/magic-link-handoff.server";
import { createUserSession } from "~/services/session.server";

const RAW_TOKEN = "a".repeat(43);

async function handoffCookieHeader(): Promise<string> {
	const serialized = await magicLinkHandoffCookie.serialize(RAW_TOKEN);
	return serialized.split(";")[0];
}

function postRequest(cookie: string) {
	return new Request("http://localhost/auth/magic-link/consume", {
		method: "POST",
		body: new URLSearchParams({ _csrf: "test" }),
		headers: { Cookie: cookie },
	});
}

describe("magic-link consume route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(validateCsrfToken as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
	});

	it("GET stashes the token without consuming or authenticating", async () => {
		const response = await loader({
			request: new Request(`http://localhost/auth/magic-link/consume?token=${RAW_TOKEN}`),
			params: {},
			context: {},
		});

		expect(response).toBeInstanceOf(Response);
		expect((response as Response).status).toBe(302);
		expect((response as Response).headers.get("Location")).toBe("/auth/magic-link/consume");
		expect((response as Response).headers.get("Set-Cookie")).toContain("__magic_link_handoff=");
		expect(consumeLoginMagicLink).not.toHaveBeenCalled();
		expect(createUserSession).not.toHaveBeenCalled();
	});

	it("POST consumes once, creates a fresh session, and clears the handoff cookie", async () => {
		(consumeLoginMagicLink as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ userId: "user-1", redirectPath: "/dashboard" })
			.mockResolvedValueOnce(null);
		const cookie = await handoffCookieHeader();

		const first = await action({ request: postRequest(cookie), params: {}, context: {} });
		const second = await action({ request: postRequest(cookie), params: {}, context: {} });

		expect(first.status).toBe(302);
		expect(first.headers.get("Location")).toBe("/dashboard");
		expect(first.headers.get("Set-Cookie")).toContain("__magic_link_handoff=");
		expect(first.headers.get("Set-Cookie")).toContain("Max-Age=0");
		expect(createUserSession).toHaveBeenCalledTimes(1);
		expect(createUserSession).toHaveBeenCalledWith("user-1", "/dashboard");
		expect(second.status).toBe(400);
		expect(await second.json()).toEqual({
			error: "This sign-in link is invalid or has expired.",
		});
		expect(second.headers.get("Set-Cookie")).toContain("Max-Age=0");
	});
});
