import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
	createUserSession,
	generateVerificationToken,
	getOptionalUser,
	registerUser,
} from "~/services/auth.server";
import { sendVerificationEmail } from "~/services/email.server";
import { checkSignupRateLimit } from "~/services/rate-limit.server";

export const meta: MetaFunction = () => {
	return [{ title: "Sign Up — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getOptionalUser(request);
	if (user) throw redirect("/dashboard");
	return null;
}

interface ActionErrors {
	name?: string;
	email?: string;
	password?: string;
	confirmPassword?: string;
	form?: string;
}

export async function action({ request }: ActionFunctionArgs) {
	const rateLimit = checkSignupRateLimit(request);
	if (rateLimit.limited) {
		return Response.json(
			{ errors: { form: "Too many signup attempts. Please try again later." } },
			{ status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
		);
	}

	const formData = await request.formData();
	const name = formData.get("name");
	const email = formData.get("email");
	const password = formData.get("password");
	const confirmPassword = formData.get("confirmPassword");

	const errors: ActionErrors = {};

	if (typeof name !== "string" || !name.trim()) {
		errors.name = "Name is required.";
	}

	if (typeof email !== "string" || !email.trim()) {
		errors.email = "Email is required.";
	} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		errors.email = "Please enter a valid email address.";
	}

	if (typeof password !== "string" || password.length < 8) {
		errors.password = "Password must be at least 8 characters.";
	}

	if (password !== confirmPassword) {
		errors.confirmPassword = "Passwords do not match.";
	}

	if (Object.keys(errors).length > 0) {
		return { errors };
	}

	try {
		const { user, isNew } = await registerUser(email as string, password as string, name as string);
		if (!isNew) {
			// Email already exists — show same success message to prevent enumeration
			return { success: true };
		}
		// Generate verification token and send email
		const appUrl = process.env.APP_URL ?? "http://localhost:5173";
		const token = await generateVerificationToken(user.id);
		await sendVerificationEmail({
			email: user.email,
			name: user.name,
			verificationUrl: `${appUrl}/verify-email?token=${token}`,
		});
		// Create session so check-email page can access user info, then redirect
		return createUserSession(user.id, "/check-email");
	} catch (error) {
		if (error instanceof Response) throw error;
		return { errors: { form: "Registration failed. Please try again." } };
	}
}

export default function Signup() {
	const actionData = useActionData<typeof action>();
	const errors = actionData && "errors" in actionData ? actionData.errors : undefined;
	const success = actionData && "success" in actionData ? actionData.success : false;
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const [password, setPassword] = useState("");

	if (success) {
		return (
			<div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
				<div className="w-full max-w-md text-center">
					<div className="text-3xl">📧</div>
					<h1 className="mt-3 text-3xl font-bold text-slate-900">Check your email</h1>
					<p className="mt-2 text-slate-600">
						If this email isn&apos;t already registered, you&apos;ll receive a verification email
						shortly.
					</p>
					<p className="mt-6 text-sm text-slate-600">
						Already have an account?{" "}
						<Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
							Sign in
						</Link>
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
			<div className="w-full max-w-md">
				<div className="text-center">
					<div className="text-3xl">🎭</div>
					<h1 className="mt-3 text-3xl font-bold text-slate-900">Create your account</h1>
					<p className="mt-2 text-slate-600">Join My Call Time and start scheduling</p>
				</div>

				<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
					{errors?.form && (
						<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{errors.form}
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
						Sign up with Google
					</a>

					<div className="relative my-6">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-slate-200" />
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="bg-white px-2 text-slate-500">or create with email</span>
						</div>
					</div>

					<Form method="post" className="space-y-4">
						<div>
							<label htmlFor="name" className="block text-sm font-medium text-slate-700">
								Name
							</label>
							<input
								id="name"
								name="name"
								type="text"
								autoComplete="name"
								required
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="Your name"
							/>
							{errors?.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
						</div>

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
							{errors?.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
						</div>

						<div>
							<label htmlFor="password" className="block text-sm font-medium text-slate-700">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="••••••••"
							/>
							{password.length > 0 && (
								<div className="mt-2 flex items-center gap-2">
									<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
										<div
											className={`h-full rounded-full transition-all ${
												password.length >= 8
													? "bg-emerald-500"
													: password.length >= 4
														? "bg-amber-500"
														: "bg-red-400"
											}`}
											style={{
												width: `${Math.min((password.length / 8) * 100, 100)}%`,
											}}
										/>
									</div>
									<span
										className={`text-xs font-medium ${
											password.length >= 8 ? "text-emerald-600" : "text-slate-400"
										}`}
									>
										{password.length >= 8 ? "Strong" : `${password.length}/8`}
									</span>
								</div>
							)}
							{errors?.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
						</div>

						<div>
							<label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
								Confirm password
							</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
								className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								placeholder="••••••••"
							/>
							{errors?.confirmPassword && (
								<p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
							)}
						</div>

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:opacity-50"
						>
							{isSubmitting ? "Creating account…" : "Create account"}
						</button>

						<p className="text-center text-xs text-slate-400">
							By signing up, you agree to our Terms of Service
						</p>
					</Form>
				</div>

				<p className="mt-6 text-center text-sm text-slate-600">
					Already have an account?{" "}
					<Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
