import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { CsrfInput } from "~/components/csrf-input";
import { getOptionalUser, requireUser } from "~/services/auth.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { joinGroup } from "~/services/groups.server";

export const meta: MetaFunction = () => {
	return [{ title: "Join Group — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code") ?? "";
	const user = await getOptionalUser(request);
	return { code, isLoggedIn: !!user };
}

export async function action({ request }: ActionFunctionArgs) {
	const user = await requireUser(request);
	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const code = formData.get("code");

	if (typeof code !== "string" || !code.trim()) {
		return { error: "Invite code is required." };
	}

	const codeStr = code.trim().toUpperCase();
	if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(codeStr)) {
		return { error: "Invalid invite code format. Codes are 8 characters." };
	}

	const result = await joinGroup(user.id, codeStr);
	if (!result.success) {
		if (result.groupId) {
			return redirect(`/groups/${result.groupId}`);
		}
		return { error: result.error };
	}

	return redirect(`/groups/${result.groupId}`);
}

export default function JoinGroup() {
	const { code, isLoggedIn } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="w-full max-w-md">
				<div className="text-center">
					<h1 className="text-3xl font-bold text-slate-900">Join a Group</h1>
					<p className="mt-2 text-slate-600">Enter an invite code to join an improv group</p>
				</div>

				<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
					{actionData?.error && (
						<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{actionData.error}
						</div>
					)}

					{!isLoggedIn && code && (
						<div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
							You need to{" "}
							<Link
								to={`/login?redirectTo=/groups/join?code=${code}`}
								className="font-medium underline"
							>
								sign in
							</Link>{" "}
							or{" "}
							<Link
								to={`/signup?redirectTo=/groups/join?code=${code}`}
								className="font-medium underline"
							>
								create an account
							</Link>{" "}
							to join this group.
						</div>
					)}

					<Form method="post" className="space-y-4">
						<CsrfInput />
						<div>
							<label htmlFor="code" className="block text-sm font-medium text-slate-700">
								Invite Code
							</label>
							<input
								id="code"
								name="code"
								type="text"
								defaultValue={code}
								required
								maxLength={8}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-center text-lg uppercase tracking-widest text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="ABCD1234"
							/>
						</div>

						<button
							type="submit"
							disabled={!isLoggedIn || isSubmitting}
							className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:opacity-50"
						>
							{isSubmitting ? "Joining…" : "Join Group"}
						</button>
					</Form>
				</div>

				<p className="mt-6 text-center text-sm text-slate-600">
					<Link to="/groups" className="font-medium text-emerald-600 hover:text-emerald-700">
						← Back to Groups
					</Link>
				</p>
			</div>
		</div>
	);
}
