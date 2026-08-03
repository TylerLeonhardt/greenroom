import { createHash } from "node:crypto";
import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { CsrfInput } from "~/components/csrf-input";
import { getUserByEmail } from "~/services/auth.server";
import { performDummyHashComparison } from "~/services/auth-timing.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { sendMagicLinkEmail } from "~/services/email.server";
import { logger } from "~/services/logger.server";
import { issueLoginMagicLink, validateMagicLinkRedirectPath } from "~/services/magic-link.server";
import { checkLoginRateLimit, checkRateLimit, getClientIp } from "~/services/rate-limit.server";

export const meta: MetaFunction = () => {
	return [{ title: "Email Sign-In Link — My Call Time" }];
};

export const MAGIC_LINK_GENERIC_RESPONSE =
	"If an account exists for that email, we sent a sign-in link. It expires in 10 minutes.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function normalizeEmail(value: FormDataEntryValue | null): string {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function digest(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function rateLimitedResponse(retryAfter: number): Response {
	return Response.json(
		{ error: "Too many sign-in link requests. Please try again later." },
		{ status: 429, headers: { "Retry-After": String(retryAfter) } },
	);
}

export async function action({ request }: ActionFunctionArgs) {
	const loginRateLimit = checkLoginRateLimit(request);
	if (loginRateLimit.limited) {
		return rateLimitedResponse(loginRateLimit.retryAfter);
	}

	const formData = await request.formData();
	await validateCsrfToken(request, formData);

	const email = normalizeEmail(formData.get("email"));
	const emailDigest = digest(email);
	const ipDigest = digest(getClientIp(request));
	const ipRateLimit = checkRateLimit(`magic-link-ip:${ipDigest}`, 5, RATE_LIMIT_WINDOW_MS);
	const emailRateLimit = checkRateLimit(`magic-link-email:${emailDigest}`, 3, RATE_LIMIT_WINDOW_MS);
	if (ipRateLimit.limited || emailRateLimit.limited) {
		const retryAfter = Math.max(
			ipRateLimit.limited ? ipRateLimit.retryAfter : 0,
			emailRateLimit.limited ? emailRateLimit.retryAfter : 0,
		);
		return rateLimitedResponse(retryAfter);
	}

	await performDummyHashComparison(email);

	if (!EMAIL_PATTERN.test(email) || email.length > 255) {
		return { success: true, message: MAGIC_LINK_GENERIC_RESPONSE };
	}

	const user = await getUserByEmail(email);
	if (user?.emailVerified && !user.deletedAt) {
		try {
			const redirectPath = validateMagicLinkRedirectPath(
				typeof formData.get("redirectTo") === "string"
					? (formData.get("redirectTo") as string)
					: null,
			);
			const { rawToken } = await issueLoginMagicLink({
				userId: user.id,
				redirectPath,
			});
			const appUrl = process.env.APP_URL ?? "http://localhost:5173";
			const emailResult = await sendMagicLinkEmail({
				email: user.email,
				name: user.name,
				magicLinkUrl: `${appUrl}/auth/magic-link/consume?token=${encodeURIComponent(rawToken)}`,
			});
			if (!emailResult.success) {
				logger.warn(
					{ userId: user.id, errorKind: emailResult.errorKind },
					"Magic-link email delivery failed",
				);
			}
		} catch (error) {
			logger.error({ err: error, userId: user.id }, "Failed to issue magic-link login");
		}
	}

	return { success: true, message: MAGIC_LINK_GENERIC_RESPONSE };
}

export default function MagicLinkRequestPage() {
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
			<div className="w-full max-w-md">
				<div className="text-center">
					<div className="text-3xl">✉️</div>
					<h1 className="mt-3 text-3xl font-bold text-slate-900">Sign in by email</h1>
					<p className="mt-2 text-slate-600">We&apos;ll send you a secure, one-time link.</p>
				</div>

				<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
					{actionData && "message" in actionData ? (
						<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
							{actionData.message}
						</div>
					) : (
						<>
							{actionData && "error" in actionData && (
								<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
									{actionData.error}
								</div>
							)}
							<Form method="post" className="space-y-4">
								<CsrfInput />
								<div>
									<label
										htmlFor="magic-link-email"
										className="block text-sm font-medium text-slate-700"
									>
										Email
									</label>
									<input
										id="magic-link-email"
										name="email"
										type="email"
										autoComplete="email"
										required
										className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
										placeholder="you@example.com"
									/>
								</div>
								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
								>
									{isSubmitting ? "Sending…" : "Email me a sign-in link"}
								</button>
							</Form>
						</>
					)}
				</div>

				<p className="mt-6 text-center text-sm text-slate-600">
					<Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
						Back to sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
