import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { verifyEmailToken } from "~/services/auth.server";

export const meta: MetaFunction = () => {
	return [{ title: "Verify Email — My Call Time" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const token = url.searchParams.get("token");

	if (!token) {
		return { error: "Invalid verification link." };
	}

	const result = await verifyEmailToken(token);

	if (result.success) {
		return redirect("/login?verified=true");
	}

	return { error: result.reason };
}

export default function VerifyEmail() {
	const data = useLoaderData<typeof loader>();

	return (
		<div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
			<div className="w-full max-w-md text-center">
				<div className="text-3xl">❌</div>
				<h1 className="mt-3 text-3xl font-bold text-slate-900">Verification Failed</h1>
				<p className="mt-2 text-slate-600">{data.error}</p>
				<div className="mt-6 space-y-3">
					<Link
						to="/login"
						className="block w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-emerald-700"
					>
						Go to Login
					</Link>
					<Link
						to="/signup"
						className="block text-sm font-medium text-emerald-600 hover:text-emerald-700"
					>
						Sign up again
					</Link>
				</div>
			</div>
		</div>
	);
}
