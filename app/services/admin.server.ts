import { requireUser } from "./auth.server.js";

export function isAdmin(email: string): boolean {
	const adminEmails = process.env.ADMIN_EMAILS ?? "";
	const list = adminEmails
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	return list.includes(email.toLowerCase());
}

export async function requireAdmin(request: Request) {
	const user = await requireUser(request);
	if (!isAdmin(user.email)) {
		throw new Response("Forbidden", { status: 403 });
	}
	return user;
}
