import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
	return [
		{ title: "GreenRoom — Improv Group Scheduling" },
		{
			name: "description",
			content: "Schedule rehearsals, shows, and manage availability for your improv group.",
		},
	];
};

export default function Index() {
	return (
		<div className="flex flex-col items-center justify-center py-20">
			<h1 className="text-5xl font-bold text-gray-900">
				🎭 Welcome to <span className="text-green-700">GreenRoom</span>
			</h1>
			<p className="mt-4 max-w-xl text-center text-lg text-gray-600">
				The scheduling platform built for improv groups. Coordinate rehearsals, manage availability,
				and never miss a show.
			</p>
			<div className="mt-8 flex gap-4">
				<Link
					to="/signup"
					className="rounded-lg bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
				>
					Get Started
				</Link>
				<Link
					to="/login"
					className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
				>
					Sign In
				</Link>
			</div>
		</div>
	);
}
