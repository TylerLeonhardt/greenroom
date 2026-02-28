import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { requireUser } from "~/services/auth.server";
import { createGroup } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Create Group — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUser(request);
	return null;
}

export async function action({ request }: ActionFunctionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();

	const name = formData.get("name");
	const description = formData.get("description");

	if (typeof name !== "string" || !name.trim()) {
		return { errors: { name: "Group name is required." } };
	}

	if (name.trim().length > 100) {
		return { errors: { name: "Group name must be 100 characters or less." } };
	}

	if (typeof description === "string" && description.trim().length > 2000) {
		return { errors: { description: "Description must be 2000 characters or less." } };
	}

	try {
		const group = await createGroup(user.id, {
			name,
			description: typeof description === "string" ? description : undefined,
		});
		return redirect(`/groups/${group.id}`);
	} catch (error) {
		if (error instanceof Response) throw error;
		return { errors: { form: "Failed to create group. Please try again." } };
	}
}

export default function NewGroup() {
	const actionData = useActionData<typeof action>();
	const errors = actionData?.errors as Record<string, string> | undefined;
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="w-full max-w-lg">
				<div className="text-center">
					<h1 className="text-3xl font-bold text-slate-900">Create a Group</h1>
					<p className="mt-2 text-slate-600">Start a new improv group and invite your ensemble</p>
				</div>

				<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
					{errors?.form && (
						<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{errors.form}
						</div>
					)}

					<Form method="post" className="space-y-4">
						<div>
							<label htmlFor="name" className="block text-sm font-medium text-slate-700">
								Group Name
							</label>
							<input
								id="name"
								name="name"
								type="text"
								required
								maxLength={100}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="e.g., The Improvables"
							/>
							{errors?.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
						</div>

						<div>
							<label htmlFor="description" className="block text-sm font-medium text-slate-700">
								Description <span className="font-normal text-slate-400">(optional)</span>
							</label>
							<textarea
								id="description"
								name="description"
								rows={3}
								maxLength={2000}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="Tell your members what this group is about..."
							/>
							{errors?.description && (
								<p className="mt-1 text-sm text-red-600">{errors.description}</p>
							)}
						</div>

						<div className="flex gap-3 pt-2">
							<button
								type="submit"
								disabled={isSubmitting}
								className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:opacity-50"
							>
								{isSubmitting ? "Creating…" : "Create Group"}
							</button>
							<Link
								to="/groups"
								className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
							>
								Cancel
							</Link>
						</div>
					</Form>
				</div>
			</div>
		</div>
	);
}
