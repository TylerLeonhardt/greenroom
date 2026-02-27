import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { getOptionalUser } from "~/services/auth.server";

export const meta: MetaFunction = () => {
	return [
		{ title: "GreenRoom — Improv Group Scheduling" },
		{
			name: "description",
			content: "Schedule rehearsals, shows, and manage availability for your improv group.",
		},
	];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getOptionalUser(request);
	if (user) throw redirect("/dashboard");
	return null;
}

export default function Index() {
	return (
		<div className="flex flex-col items-center justify-center py-20">
			<h1 className="text-5xl font-bold text-slate-900">
				🎭 <span className="text-emerald-600">GreenRoom</span>
			</h1>
			<p className="mt-2 text-xl font-medium text-slate-600">Where your ensemble comes together</p>
			<p className="mt-4 max-w-xl text-center text-lg text-slate-500">
				Schedule rehearsals, find availability, manage shows — all in one place.
			</p>
			<div className="mt-8 flex gap-4">
				<Link
					to="/signup"
					className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700"
				>
					Get Started
				</Link>
				<Link
					to="/login"
					className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
				>
					Sign In
				</Link>
			</div>
		</div>
	);
}
