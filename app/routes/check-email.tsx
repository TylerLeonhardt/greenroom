import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { CsrfInput } from "~/components/csrf-input";
import { generateVerificationToken, getUserByEmail } from "~/services/auth.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { sendVerificationEmail } from "~/services/email.server";
import { checkResendVerificationRateLimit } from "~/services/rate-limit.server";

export const meta: MetaFunction = () => {
	return [{ title: "Check Your Email — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const email = url.searchParams.get("email");
	return { email };
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	await validateCsrfToken(request, formData);
	const intent = formData.get("intent");

	// "Wrong email?" — redirect to signup
	if (intent === "change-email") {
		return redirect("/signup");
	}

	const email = formData.get("email");
	if (typeof email !== "string" || !email.trim()) {
		return redirect("/signup");
	}

	const rateLimit = checkResendVerificationRateLimit(email);
	if (rateLimit.limited) {
		return {
			error: `Please wait ${rateLimit.retryAfter} seconds before requesting another email.`,
		};
	}

	// Look up user by email — return success regardless to prevent enumeration
	const user = await getUserByEmail(email);
	if (!user || user.emailVerified) {
		return { success: true };
	}

	const appUrl = process.env.APP_URL ?? "http://localhost:5173";
	const token = await generateVerificationToken(user.id);

	await sendVerificationEmail({
		email,
		name: user.name ?? "there",
		verificationUrl: `${appUrl}/verify-email?token=${token}`,
	});

	return { success: true };
}

export default function CheckEmail() {
	const { email } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
			<div className="w-full max-w-md text-center">
				<div className="text-3xl">📧</div>
				<h1 className="mt-3 text-3xl font-bold text-slate-900">Check your email</h1>
				{email ? (
					<p className="mt-2 text-slate-600">
						We sent a verification link to{" "}
						<span className="font-medium text-slate-900">{email}</span>
					</p>
				) : (
					<p className="mt-2 text-slate-600">We sent a verification link to your email address.</p>
				)}
				<p className="mt-1 text-sm text-slate-500">
					Click the link in the email to verify your account. The link expires in 24 hours.
				</p>

				{email && (
					<div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						{actionData && "success" in actionData && actionData.success && (
							<div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
								Verification email resent! Check your inbox.
							</div>
						)}
						{actionData && "error" in actionData && (
							<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								{actionData.error}
							</div>
						)}

						<p className="mb-3 text-sm text-slate-600">Didn&apos;t receive the email?</p>
						<Form method="post">
							<CsrfInput />
							<input type="hidden" name="email" value={email} />
							<button
								type="submit"
								disabled={isSubmitting}
								className="w-full rounded-lg border border-emerald-600 px-4 py-2.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
							>
								{isSubmitting ? "Sending…" : "Resend verification email"}
							</button>
						</Form>
					</div>
				)}

				<div className="mt-6">
					<p className="text-sm text-slate-600">
						Wrong email?{" "}
						<Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-700">
							Sign up with a different email
						</Link>
					</p>
				</div>

				<p className="mt-4 text-sm text-slate-600">
					Already verified?{" "}
					<Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
