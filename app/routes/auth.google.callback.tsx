import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import {
	createUserSession,
	exchangeGoogleCode,
	findOrCreateGoogleUser,
} from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const error = url.searchParams.get("error");

	if (error) {
		return redirect("/login");
	}

	if (!code) {
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
