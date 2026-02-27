import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import {
	createUserSession,
	exchangeGoogleCode,
	findOrCreateGoogleUser,
	verifyOAuthState,
} from "~/services/auth.server";

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
		return createUserSession(user.id, "/dashboard");
	} catch {
		return redirect("/login");
	}
}
