import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../src/db/index.js";
import { magicLinkTokens } from "../../../src/db/schema.js";
import { createTestUser } from "../../services/__integration__/seed.js";
import { cleanDatabase } from "../../services/__integration__/setup.js";
import { generateCsrfToken } from "../../services/csrf.server.js";
import { issueLoginMagicLink } from "../../services/magic-link.server.js";
import { action, loader } from "../auth.magic-link.consume.js";

type StoredCookie = {
	name: string;
	value: string;
	path: string;
};

class TestCookieJar {
	private readonly cookies = new Map<string, StoredCookie>();

	store(setCookie: string): void {
		const parts = setCookie.split(";").map((part) => part.trim());
		const [nameValue = "", ...attributes] = parts;
		const separator = nameValue.indexOf("=");
		if (separator === -1) throw new Error("Invalid Set-Cookie header");

		const name = nameValue.slice(0, separator);
		const value = nameValue.slice(separator + 1);
		const pathAttribute = attributes.find((attribute) =>
			attribute.toLowerCase().startsWith("path="),
		);
		const path = pathAttribute?.slice("path=".length) ?? "/";
		this.cookies.set(name, { name, value, path });
	}

	headerFor(requestPath: string): string {
		return Array.from(this.cookies.values())
			.filter(({ path }) => {
				if (requestPath === path) return true;
				if (!requestPath.startsWith(path)) return false;
				return path.endsWith("/") || requestPath.charAt(path.length) === "/";
			})
			.map(({ name, value }) => `${name}=${value}`)
			.join("; ");
	}
}

beforeEach(async () => {
	await cleanDatabase();
});

describe("magic-link consume route integration", () => {
	it("survives the GET redirect and Remix .data POST before consuming in Postgres", async () => {
		const user = await createTestUser();
		const issued = await issueLoginMagicLink({ userId: user.id });
		expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now() + 9 * 60 * 1000);

		const jar = new TestCookieJar();
		const linkResponse = await loader({
			request: new Request(`http://localhost/auth/magic-link/consume?token=${issued.rawToken}`),
			params: {},
			context: {},
		});
		expect(linkResponse.status).toBe(302);
		expect(linkResponse.headers.get("Location")).toBe("/auth/magic-link/consume");
		expect(linkResponse.headers.get("Referrer-Policy")).toBe("no-referrer");
		const handoffSetCookie = linkResponse.headers.get("Set-Cookie");
		expect(handoffSetCookie).not.toBeNull();
		jar.store(handoffSetCookie ?? "");

		const cleanPath = "/auth/magic-link/consume";
		const cleanResponse = await loader({
			request: new Request(`http://localhost${cleanPath}`, {
				headers: { Cookie: jar.headerFor(cleanPath) },
			}),
			params: {},
			context: {},
		});
		expect(await cleanResponse.json()).toEqual({ hasToken: true });
		expect(cleanResponse.headers.get("Referrer-Policy")).toBe("same-origin");

		const csrfRequest = new Request(`http://localhost${cleanPath}`, {
			headers: { Cookie: jar.headerFor(cleanPath) },
		});
		const { token: csrfToken, cookie: csrfSetCookie } = await generateCsrfToken(csrfRequest);
		jar.store(csrfSetCookie);

		const dataPath = "/auth/magic-link/consume.data";
		const consumeResponse = await action({
			request: new Request(`http://localhost${dataPath}`, {
				method: "POST",
				body: new URLSearchParams({ _csrf: csrfToken }),
				headers: { Cookie: jar.headerFor(dataPath) },
			}),
			params: {},
			context: {},
		});

		expect(consumeResponse.status).toBe(302);
		expect(consumeResponse.headers.get("Location")).toBe("/dashboard");
		const [stored] = await db
			.select({ consumedAt: magicLinkTokens.consumedAt })
			.from(magicLinkTokens)
			.where(eq(magicLinkTokens.userId, user.id));
		expect(stored?.consumedAt).not.toBeNull();
	});
});
