import { randomBytes } from "node:crypto";
import { getSession, sessionStorage } from "./session.server";

const CSRF_SESSION_KEY = "csrfToken";

export async function generateCsrfToken(request: Request): Promise<{
	token: string;
	cookie: string;
}> {
	const session = await getSession(request);
	let token = session.get(CSRF_SESSION_KEY);
	if (typeof token !== "string" || !token) {
		token = randomBytes(32).toString("hex");
		session.set(CSRF_SESSION_KEY, token);
	}
	return {
		token,
		cookie: await sessionStorage.commitSession(session),
	};
}

export async function validateCsrfToken(request: Request, formData: FormData): Promise<void> {
	const session = await getSession(request);
	const sessionToken = session.get(CSRF_SESSION_KEY);
	const formToken = formData.get("_csrf");

	if (
		typeof sessionToken !== "string" ||
		typeof formToken !== "string" ||
		!sessionToken ||
		!formToken ||
		sessionToken !== formToken
	) {
		throw new Response("Invalid CSRF token", { status: 403 });
	}
}
