import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { validateCsrfToken } from "~/services/csrf.server";
import { destroyUserSession } from "~/services/session.server";

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	return destroyUserSession(request, "/");
}

export async function loader() {
	return redirect("/");
}
