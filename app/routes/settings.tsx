import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { Globe, Save } from "lucide-react";
import { useEffect, useRef } from "react";
import { COMMON_TIMEZONES, getTimezoneLabel } from "~/components/timezone-selector";
import { requireUser, updateUserTimezone } from "~/services/auth.server";

export const meta: MetaFunction = () => {
	return [{ title: "Settings — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await requireUser(request);
	return { user };
}

export async function action({ request }: ActionFunctionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "update-timezone") {
		const timezone = formData.get("timezone");
		if (typeof timezone !== "string" || !timezone.trim()) {
			return { error: "Timezone is required." };
		}
		// Validate it's a real IANA timezone
		try {
			Intl.DateTimeFormat(undefined, { timeZone: timezone });
		} catch {
			return { error: "Invalid timezone." };
		}
		await updateUserTimezone(user.id, timezone.trim());
		return { success: true, message: "Timezone updated!" };
	}

	return { error: "Invalid action." };
}

export default function Settings() {
	const { user } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const submit = useSubmit();
	const autoDetectDone = useRef(false);

	// Auto-detect timezone on first visit if not set
	useEffect(() => {
		if (!user.timezone && !autoDetectDone.current) {
			autoDetectDone.current = true;
			const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (detected) {
				const formData = new FormData();
				formData.set("intent", "update-timezone");
				formData.set("timezone", detected);
				submit(formData, { method: "post" });
			}
		}
	}, [user.timezone, submit]);

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-slate-900">Settings</h1>
				<p className="mt-1 text-sm text-slate-600">Manage your account preferences</p>
			</div>

			{/* Feedback */}
			{actionData && "message" in actionData && actionData.success && (
				<div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{actionData.message}
				</div>
			)}
			{actionData && "error" in actionData && (
				<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			{/* Timezone */}
			<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
					<Globe className="h-5 w-5 text-slate-400" />
					Timezone
				</h2>
				<p className="mt-1 text-sm text-slate-600">
					Set your timezone so dates and times display correctly.
				</p>
				<Form method="post" className="mt-4">
					<input type="hidden" name="intent" value="update-timezone" />
					<div className="flex items-end gap-3">
						<div className="flex-1">
							<label htmlFor="timezone" className="block text-sm font-medium text-slate-700">
								Your Timezone
							</label>
							<select
								id="timezone"
								name="timezone"
								defaultValue={user.timezone ?? ""}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							>
								<option value="" disabled>
									Select timezone...
								</option>
								{COMMON_TIMEZONES.map((tz) => (
									<option key={tz} value={tz}>
										{getTimezoneLabel(tz)}
									</option>
								))}
							</select>
						</div>
						<button
							type="submit"
							disabled={isSubmitting}
							className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
						>
							<Save className="h-4 w-4" />
							{isSubmitting ? "Saving..." : "Save"}
						</button>
					</div>
				</Form>
			</div>

			{/* Profile Info (read-only) */}
			<div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Profile</h2>
				<dl className="mt-4 space-y-3">
					<div className="flex justify-between">
						<dt className="text-sm text-slate-500">Name</dt>
						<dd className="text-sm font-medium text-slate-900">{user.name}</dd>
					</div>
					<div className="flex justify-between">
						<dt className="text-sm text-slate-500">Email</dt>
						<dd className="text-sm font-medium text-slate-900">{user.email}</dd>
					</div>
				</dl>
			</div>
		</div>
	);
}
