import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { CsrfInput } from "~/components/csrf-input";
import { GoogleAuthButton } from "~/components/google-auth-button";
import {
	authenticator,
	createUserSession,
	getOptionalUser,
	getUserDeletedAt,
	isEmailVerified,
	reactivateAccount,
} from "~/services/auth.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { logger } from "~/services/logger.server";
import { checkLoginRateLimit } from "~/services/rate-limit.server";

export const meta: MetaFunction = () => {
	return [{ title: "Login — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getOptionalUser(request);
	if (user) throw redirect("/dashboard");
	const url = new URL(request.url);
	const verified = url.searchParams.get("verified") === "true";
	return { verified };
}

export async function action({ request }: ActionFunctionArgs) {
	const rateLimit = checkLoginRateLimit(request);
	if (rateLimit.limited) {
		return Response.json(
			{ error: "Too many login attempts. Please try again later." },
			{ status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
		);
	}

	const clonedRequest = request.clone();
	const formData = await clonedRequest.formData();
	await validateCsrfToken(request, formData);
	const email = formData.get("email");
	const password = formData.get("password");

	if (typeof email !== "string" || !email.trim()) {
		return { error: "Email is required." };
	}
	if (typeof password !== "string" || !password) {
		return { error: "Password is required." };
	}
	if (password.length > 128) {
		return { error: "Password is too long." };
	}

	try {
		const user = await authenticator.authenticate("form", request);

		// Block unverified users from logging in
		const verified = await isEmailVerified(user.id);
		if (!verified) {
			return {
				error:
					"Please verify your email first. Check your inbox or request a new verification link.",
			};
		}

		// Reactivate soft-deleted accounts on login (30-day grace period)
		const deletedAt = await getUserDeletedAt(user.id);
		if (deletedAt) {
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			if (deletedAt < thirtyDaysAgo) {
				return { error: "This account has been permanently deleted." };
			}
			await reactivateAccount(user.id);
		}

		return createUserSession(user.id, "/dashboard");
	} catch (error) {
		if (error instanceof Response) throw error;
		logger.error({ err: error, route: "login" }, "Login failed");
		const message = error instanceof Error ? error.message : "Login failed.";
		return { error: message };
	}
}

export default function Login() {
	const { verified } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
			<div className="w-full max-w-md">
				<div className="text-center">
					<div className="text-3xl">🎭</div>
					<h1 className="mt-3 text-3xl font-bold text-slate-900">Welcome back</h1>
					<p className="mt-2 text-slate-600">Sign in to your My Call Time account</p>
				</div>

				<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
					{verified && (
						<div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
							Email verified successfully! You can now sign in.
						</div>
					)}
					{actionData?.error && (
						<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{actionData.error}
						</div>
					)}

					<GoogleAuthButton>Sign in with Google</GoogleAuthButton>

					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-slate-200" />
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="bg-white px-2 text-slate-500">or continue with email</span>
						</div>
					</div>

					<Form method="post" className="space-y-4">
						<CsrfInput />
						<div>
							<label htmlFor="email" className="block text-sm font-medium text-slate-700">
								Email
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="you@example.com"
							/>
						</div>

						<div>
							<label htmlFor="password" className="block text-sm font-medium text-slate-700">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="••••••••"
							/>
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:opacity-50"
						>
							{isSubmitting ? "Signing in…" : "Sign in"}
						</button>
					</Form>
				</div>

				<p className="mt-6 text-center text-sm text-slate-600">
					Don&apos;t have an account?{" "}
					<Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-700">
						Sign up
					</Link>
				</p>
			</div>
		</div>
	);
}
