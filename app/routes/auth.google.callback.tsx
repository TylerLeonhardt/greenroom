import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import {
	createUserSession,
	exchangeGoogleCode,
	findOrCreateGoogleUser,
	getUserDeletedAt,
	reactivateAccount,
	verifyOAuthState,
} from "~/services/auth.server";
import { logger } from "~/services/logger.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");
	const state = url.searchParams.get("state");

	if (error) {
		return redirect("/login");
	}

	if (!code) {
		return redirect("/login");
	}

	const validState = await verifyOAuthState(request, state);
	if (!validState) {
		return redirect("/login");
	}

	try {
		const profile = await exchangeGoogleCode(code);
		const user = await findOrCreateGoogleUser(profile);

		// Reactivate soft-deleted accounts on login
		const deletedAt = await getUserDeletedAt(user.id);
		if (deletedAt) {
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			if (deletedAt < thirtyDaysAgo) {
				return redirect("/login");
			}
			await reactivateAccount(user.id);
		}

		return createUserSession(user.id, "/dashboard");
	} catch (error) {
		logger.error({ err: error, route: "auth.google.callback" }, "Google OAuth login failed");
		return redirect("/login");
	}
}
