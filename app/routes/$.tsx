import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
	return [{ title: "Page Not Found — GreenRoom" }];
};

export default function CatchAll() {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<div className="text-6xl">🔍</div>
			<h1 className="mt-6 text-3xl font-bold text-slate-900">Page not found</h1>
			<p className="mt-3 text-lg text-slate-500">
				The page you&apos;re looking for doesn&apos;t exist or has been moved.
			</p>
			<Link
				to="/dashboard"
				className="mt-8 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
			>
				Back to Dashboard
			</Link>
		</div>
	);
}
