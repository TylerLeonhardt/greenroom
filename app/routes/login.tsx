import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { CsrfInput } from "~/components/csrf-input";
import {
	authenticator,
	createUserSession,
	getOptionalUser,
	isEmailVerified,
} from "~/services/auth.server";
import { validateCsrfToken } from "~/services/csrf.server";
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

		return createUserSession(user.id, "/dashboard");
	} catch (error) {
		if (error instanceof Response) throw error;
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

					<a
						href="/auth/google"
						className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						<svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
								fill="#4285F4"
							/>
							<path
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								fill="#34A853"
							/>
							<path
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								fill="#FBBC05"
							/>
							<path
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								fill="#EA4335"
							/>
						</svg>
						Sign in with Google
					</a>

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
