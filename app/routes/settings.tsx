import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
	AlertTriangle,
	CalendarSync,
	Check,
	Copy,
	Globe,
	RefreshCw,
	Save,
	User,
} from "lucide-react";
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import { DangerZone } from "~/components/danger-zone";
import { COMMON_TIMEZONES, getTimezoneLabel } from "~/components/timezone-selector";
import { isValidTimezone } from "~/lib/date-utils";
import { requireUser, updateUserName, updateUserTimezone } from "~/services/auth.server";
import { getCalendarToken, regenerateCalendarToken } from "~/services/calendar-token.server";
import { validateCsrfToken } from "~/services/csrf.server";

export const meta: MetaFunction = () => {
	return [{ title: "Settings — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await requireUser(request);
	const calendarToken = await getCalendarToken(user.id);
	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;
	return { user, calendarToken, baseUrl };
}

export async function action({ request }: ActionFunctionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	if (intent === "update-name") {
		const name = formData.get("name");
		if (typeof name !== "string" || !name.trim()) {
			return { error: "Display name is required." };
		}
		const trimmedName = name.trim();
		if (trimmedName.length > 100) {
			return { error: "Display name must be 100 characters or less." };
		}
		await updateUserName(user.id, trimmedName);
		return { success: true, message: "Display name updated!" };
	}

	if (intent === "update-timezone") {
		const timezone = formData.get("timezone");
		if (typeof timezone !== "string" || !timezone.trim()) {
			return { error: "Timezone is required." };
		}
		// Validate it's a real IANA timezone (rejects abbreviations like "PST", "EST")
		if (!isValidTimezone(timezone.trim())) {
			return { error: "Invalid timezone. Please select a valid IANA timezone." };
		}
		await updateUserTimezone(user.id, timezone.trim());
		return { success: true, message: "Timezone updated!" };
	}

	if (intent === "generate-calendar-token") {
		const token = await regenerateCalendarToken(user.id);
		return { success: true, message: "Calendar feed URL generated!", calendarToken: token };
	}

	if (intent === "regenerate-calendar-token") {
		const token = await regenerateCalendarToken(user.id);
		return {
			success: true,
			message: "Calendar feed URL regenerated! Update the URL in your calendar app.",
			calendarToken: token,
		};
	}

	return { error: "Invalid action." };
}

export default function Settings() {
	const { user, calendarToken, baseUrl } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const [copied, setCopied] = useState(false);

	// Use the token from action response (after generate/regenerate) or from loader
	const activeToken =
		actionData && "calendarToken" in actionData ? actionData.calendarToken : calendarToken;

	const feedHttpsUrl = activeToken ? `${baseUrl}/api/calendar/${activeToken}.ics` : null;
	const feedWebcalUrl = feedHttpsUrl ? feedHttpsUrl.replace(/^https?:\/\//, "webcal://") : null;

	function handleCopy() {
		if (feedWebcalUrl) {
			navigator.clipboard.writeText(feedWebcalUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}

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

			{/* Display Name */}
			<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
					<User className="h-5 w-5 text-slate-400" />
					Display Name
				</h2>
				<p className="mt-1 text-sm text-slate-600">
					This is how your name appears to other group members.
				</p>
				<Form method="post" className="mt-4">
					<CsrfInput />
					<input type="hidden" name="intent" value="update-name" />
					<div className="flex items-end gap-3">
						<div className="flex-1">
							<label htmlFor="name" className="block text-sm font-medium text-slate-700">
								Your Name
							</label>
							<input
								type="text"
								id="name"
								name="name"
								defaultValue={user.name}
								required
								maxLength={100}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
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

			{/* Timezone */}
			<div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
					<Globe className="h-5 w-5 text-slate-400" />
					Timezone
				</h2>
				<p className="mt-1 text-sm text-slate-600">
					Set your timezone so dates and times display correctly.
				</p>
				<Form method="post" className="mt-4">
					<CsrfInput />
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

			{/* Calendar Feed */}
			<div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
					<CalendarSync className="h-5 w-5 text-slate-400" />
					Calendar Feed
				</h2>
				<p className="mt-1 text-sm text-slate-600">
					Subscribe to your events in Apple Calendar, Google Calendar, or Outlook. Events from all
					your groups appear automatically.
				</p>

				{activeToken ? (
					<div className="mt-4 space-y-4">
						<div>
							<label htmlFor="webcal-url" className="block text-sm font-medium text-slate-700">
								Calendar URL (webcal)
							</label>
							<div className="mt-1 flex gap-2">
								<input
									type="text"
									id="webcal-url"
									readOnly
									value={feedWebcalUrl ?? ""}
									className="block flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 shadow-sm"
								/>
								<button
									type="button"
									onClick={handleCopy}
									className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
								>
									{copied ? (
										<>
											<Check className="h-4 w-4 text-emerald-600" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											Copy
										</>
									)}
								</button>
							</div>
						</div>

						<details className="text-sm text-slate-600">
							<summary className="cursor-pointer font-medium text-slate-700 hover:text-slate-900">
								HTTPS URL (for Google Calendar)
							</summary>
							<input
								type="text"
								readOnly
								value={feedHttpsUrl ?? ""}
								className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 shadow-sm"
							/>
						</details>

						<Form method="post">
							<CsrfInput />
							<input type="hidden" name="intent" value="regenerate-calendar-token" />
							<button
								type="submit"
								disabled={isSubmitting}
								className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
							>
								<RefreshCw className="h-4 w-4" />
								{isSubmitting ? "Regenerating..." : "Regenerate URL"}
							</button>
							<p className="mt-1.5 text-xs text-slate-500">
								Regenerating will invalidate your current URL. You'll need to re-add the new URL to
								your calendar app.
							</p>
						</Form>
					</div>
				) : (
					<Form method="post" className="mt-4">
						<CsrfInput />
						<input type="hidden" name="intent" value="generate-calendar-token" />
						<button
							type="submit"
							disabled={isSubmitting}
							className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
						>
							<CalendarSync className="h-4 w-4" />
							{isSubmitting ? "Generating..." : "Generate Calendar URL"}
						</button>
					</Form>
				)}
			</div>

			{/* Account Info (read-only) */}
			<div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">Account</h2>
				<dl className="mt-4">
					<div className="flex justify-between">
						<dt className="text-sm text-slate-500">Email</dt>
						<dd className="text-sm font-medium text-slate-900">{user.email}</dd>
					</div>
				</dl>
			</div>

			{/* Danger Zone */}
			<div className="mt-6">
				<DangerZone
					variant="card"
					icon={<AlertTriangle className="h-5 w-5" />}
					subtitle="Delete your account"
					description="Permanently delete your account and all associated data. You will have 30 days to reactivate your account by logging back in."
				>
					<Link
						to="/settings/delete-account"
						className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
					>
						Delete Account
					</Link>
				</DangerZone>
			</div>
		</div>
	);
}
