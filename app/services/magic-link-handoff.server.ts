import { createCookie } from "@remix-run/node";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
	throw new Error("SESSION_SECRET environment variable is required");
}

const HANDOFF_COOKIE_MAX_AGE_SECONDS = 5 * 60;
const MAGIC_LINK_PATH = "/auth/magic-link";

export const magicLinkHandoffCookie = createCookie("__magic_link_handoff", {
	httpOnly: true,
	maxAge: HANDOFF_COOKIE_MAX_AGE_SECONDS,
	path: MAGIC_LINK_PATH,
	sameSite: "lax",
	secrets: [sessionSecret],
	secure: process.env.NODE_ENV === "production",
});

export function serializeMagicLinkHandoff(rawToken: string): Promise<string> {
	return magicLinkHandoffCookie.serialize(rawToken);
}

export function parseMagicLinkHandoff(request: Request): Promise<unknown> {
	return magicLinkHandoffCookie.parse(request.headers.get("Cookie"));
}

export function clearMagicLinkHandoff(): Promise<string> {
	return magicLinkHandoffCookie.serialize("", { maxAge: 0 });
}
