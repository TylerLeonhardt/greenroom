import { createCookieSessionStorage, redirect } from "@remix-run/node";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
	throw new Error("SESSION_SECRET environment variable is required");
}

export const sessionStorage = createCookieSessionStorage({
	cookie: {
		name: "__greenroom_session",
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 30, // 30 days
		path: "/",
		sameSite: "lax",
		secrets: [sessionSecret],
		secure: process.env.NODE_ENV === "production",
	},
});

const USER_SESSION_KEY = "userId";

export async function getSession(request: Request) {
	const cookie = request.headers.get("Cookie");
	return sessionStorage.getSession(cookie);
}

export async function getUserId(request: Request): Promise<string | undefined> {
	const session = await getSession(request);
	const userId = session.get(USER_SESSION_KEY);
	return typeof userId === "string" ? userId : undefined;
}

export async function createUserSession(userId: string, redirectTo: string) {
	const session = await sessionStorage.getSession();
	session.set(USER_SESSION_KEY, userId);
	return redirect(redirectTo, {
		headers: {
			"Set-Cookie": await sessionStorage.commitSession(session),
		},
	});
}

export async function destroyUserSession(request: Request, redirectTo: string) {
	const session = await getSession(request);
	return redirect(redirectTo, {
		headers: {
			"Set-Cookie": await sessionStorage.destroySession(session),
		},
	});
}
