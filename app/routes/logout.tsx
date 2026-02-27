import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { destroyUserSession } from "~/services/session.server";

export async function action({ request }: ActionFunctionArgs) {
	return destroyUserSession(request, "/");
}

export async function loader() {
	return redirect("/");
}
