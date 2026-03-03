import type { ActionFunctionArgs } from "@remix-run/node";
import { isValidTimezone } from "~/lib/date-utils";
import { requireUser, updateUserTimezone } from "~/services/auth.server";
import { validateCsrfToken } from "~/services/csrf.server";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const user = await requireUser(request);
	const formData = await request.formData();
	await validateCsrfToken(request, formData);

	const timezone = formData.get("timezone");
	if (typeof timezone !== "string" || !timezone.trim()) {
		return Response.json({ error: "Timezone is required." }, { status: 400 });
	}

	if (!isValidTimezone(timezone.trim())) {
		return Response.json({ error: "Invalid timezone." }, { status: 400 });
	}

	await updateUserTimezone(user.id, timezone.trim());
	return Response.json({ success: true });
}
