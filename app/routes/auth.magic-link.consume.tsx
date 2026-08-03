import type {
	ActionFunctionArgs,
	HeadersFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { CsrfInput } from "~/components/csrf-input";
import { validateCsrfToken } from "~/services/csrf.server";
import {
	consumeLoginMagicLink,
	hashMagicLinkToken,
	isValidMagicLinkToken,
} from "~/services/magic-link.server";
import {
	clearMagicLinkHandoff,
	parseMagicLinkHandoff,
	serializeMagicLinkHandoff,
} from "~/services/magic-link-handoff.server";
import { createUserSession } from "~/services/session.server";

export const meta: MetaFunction = () => [
	{ title: "Continue Sign-In — My Call Time" },
	{ name: "referrer", content: "same-origin" },
];

export const headers: HeadersFunction = ({ actionHeaders, loaderHeaders }) => ({
	"Referrer-Policy":
		actionHeaders.get("Referrer-Policy") ?? loaderHeaders.get("Referrer-Policy") ?? "same-origin",
});

const CONSUME_PATH = "/auth/magic-link/consume";
const GENERIC_ERROR = "This sign-in link is invalid or has expired.";

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const token = url.searchParams.get("token");

	if (token !== null) {
		const cookie = isValidMagicLinkToken(token)
			? await serializeMagicLinkHandoff(token)
			: await clearMagicLinkHandoff();
		return redirect(CONSUME_PATH, {
			headers: {
				"Referrer-Policy": "no-referrer",
				"Set-Cookie": cookie,
			},
		});
	}

	const handoff = await parseMagicLinkHandoff(request);
	const hasToken = typeof handoff === "string" && isValidMagicLinkToken(handoff);
	return Response.json({ hasToken }, { headers: { "Referrer-Policy": "same-origin" } });
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	await validateCsrfToken(request, formData);

	const clearCookie = await clearMagicLinkHandoff();
	const handoff = await parseMagicLinkHandoff(request);
	if (typeof handoff !== "string" || !isValidMagicLinkToken(handoff)) {
		return Response.json(
			{ error: GENERIC_ERROR },
			{
				status: 400,
				headers: {
					"Referrer-Policy": "same-origin",
					"Set-Cookie": clearCookie,
				},
			},
		);
	}

	const consumed = await consumeLoginMagicLink(hashMagicLinkToken(handoff));
	if (!consumed) {
		return Response.json(
			{ error: GENERIC_ERROR },
			{
				status: 400,
				headers: {
					"Referrer-Policy": "same-origin",
					"Set-Cookie": clearCookie,
				},
			},
		);
	}

	const response = await createUserSession(consumed.userId, consumed.redirectPath);
	response.headers.append("Set-Cookie", clearCookie);
	response.headers.set("Referrer-Policy", "same-origin");
	return response;
}

export default function MagicLinkConsumePage() {
	const { hasToken } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state === "submitting";
	const error =
		actionData && "error" in actionData ? actionData.error : !hasToken ? GENERIC_ERROR : null;

	return (
		<div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
			<div className="w-full max-w-md text-center">
				<div className="text-3xl">🎭</div>
				<h1 className="mt-3 text-3xl font-bold text-slate-900">Continue to My Call Time</h1>
				<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
					{error ? (
						<>
							<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								{error}
							</div>
							<Link
								to="/login"
								className="mt-6 inline-flex font-medium text-emerald-600 hover:text-emerald-700"
							>
								Request a new link
							</Link>
						</>
					) : (
						<>
							<p className="mb-6 text-sm text-slate-600">
								Select continue to securely finish signing in.
							</p>
							<Form method="post">
								<CsrfInput />
								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
								>
									{isSubmitting ? "Signing in…" : "Continue to My Call Time"}
								</button>
							</Form>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
