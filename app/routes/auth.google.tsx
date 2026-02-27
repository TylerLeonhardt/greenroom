import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { getGoogleAuthURL } from "~/services/auth.server";

export async function loader(_args: LoaderFunctionArgs) {
	return redirect(getGoogleAuthURL());
}
