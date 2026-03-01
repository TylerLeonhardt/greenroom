import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { CsrfInput } from "~/components/csrf-input";
import { validateCsrfToken } from "~/services/csrf.server";
import {
	getNotificationPreferences,
	requireGroupMember,
	updateNotificationPreferences,
} from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Notification Preferences — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupMember(request, groupId);
	const preferences = await getNotificationPreferences(user.id, groupId);
	return { preferences };
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupMember(request, groupId);
	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	if (intent !== "update-preferences") {
		return { error: "Invalid action.", success: false };
	}

	const preferences = {
		availabilityRequests: { email: formData.get("availabilityRequests") === "on" },
		eventNotifications: { email: formData.get("eventNotifications") === "on" },
		showReminders: { email: formData.get("showReminders") === "on" },
	};

	try {
		await updateNotificationPreferences(user.id, groupId, preferences);
		return { success: true, message: "Notification preferences updated." };
	} catch {
		return { error: "Failed to update preferences.", success: false };
	}
}

const NOTIFICATION_CATEGORIES = [
	{
		key: "availabilityRequests" as const,
		label: "Availability requests",
		description: "Get notified when someone creates a new availability request in this group",
	},
	{
		key: "eventNotifications" as const,
		label: "Event notifications",
		description:
			"Get notified when events are created or you're assigned to an event in this group",
	},
	{
		key: "showReminders" as const,
		label: "Show reminders",
		description: "Get reminder emails before events you're confirmed for",
		comingSoon: true,
	},
];

export default function GroupNotifications() {
	const { preferences } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="max-w-2xl space-y-8">
			{actionData?.success && "message" in actionData && (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
					{actionData.message}
				</div>
			)}
			{actionData && "error" in actionData && actionData.error && (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{actionData.error}
				</div>
			)}

			<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-100 px-6 py-4">
					<h2 className="text-lg font-semibold text-slate-900">Email Notifications</h2>
					<p className="mt-1 text-sm text-slate-500">
						Choose which email notifications you receive from this group
					</p>
				</div>
				<Form method="post" className="p-6">
					<CsrfInput />
					<input type="hidden" name="intent" value="update-preferences" />
					<div className="space-y-4">
						{NOTIFICATION_CATEGORIES.map((category) => (
							<label key={category.key} className="flex items-center justify-between gap-4">
								<div>
									<span className="text-sm font-medium text-slate-700">
										{category.label}
										{category.comingSoon && (
											<span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
												Coming soon
											</span>
										)}
									</span>
									<p className="text-xs text-slate-500">{category.description}</p>
								</div>
								<input
									type="checkbox"
									name={category.key}
									defaultChecked={preferences[category.key].email}
									className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
								/>
							</label>
						))}
					</div>
					<button
						type="submit"
						disabled={isSubmitting}
						className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:opacity-50"
					>
						{isSubmitting ? "Saving..." : "Save Preferences"}
					</button>
				</Form>
			</div>
		</div>
	);
}
