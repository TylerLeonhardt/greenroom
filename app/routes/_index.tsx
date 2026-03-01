import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Link, useRouteLoaderData } from "@remix-run/react";
import type { loader as rootLoader } from "~/root";
import { getOptionalUser } from "~/services/auth.server";

export const meta: MetaFunction = () => {
	return [
		{ title: "My Call Time — Scheduling for Improv Groups" },
		{
			name: "description",
			content:
				"My Call Time is a free scheduling platform for improv groups. Find availability, schedule rehearsals, and never miss a show.",
		},
		{ property: "og:title", content: "My Call Time — Scheduling for Improv Groups" },
		{
			property: "og:description",
			content:
				"My Call Time is a free scheduling platform for improv groups. Find availability, schedule rehearsals, and never miss a show.",
		},
		{ property: "og:type", content: "website" },
	];
};

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getOptionalUser(request);
	if (user) throw redirect("/dashboard");
	const supportUrl = process.env.SUPPORT_URL || null;
	return Response.json({ supportUrl });
}

const features = [
	{
		emoji: "📋",
		title: "Find Availability",
		description:
			"Send out availability requests. Members respond with Available, Maybe, or Not Available. See instantly which days work best.",
	},
	{
		emoji: "📊",
		title: "Smart Scheduling",
		description:
			"Our heatmap shows you the best rehearsal days at a glance. Turn results into committed events with one click.",
	},
	{
		emoji: "🎭",
		title: "Manage Shows",
		description: "Track upcoming shows, manage cast lists, and keep everyone on the same page.",
	},
	{
		emoji: "👥",
		title: "Built for Groups",
		description:
			"Multi-group support. Invite codes to join. Works for any ensemble, troupe, or team.",
	},
];

export default function Index() {
	const rootData = useRouteLoaderData<typeof rootLoader>("root");
	const supportUrl = rootData?.supportUrl;
	return (
		<div>
			{/* Hero */}
			<section className="bg-gradient-to-b from-emerald-50 to-white">
				<div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
					<div className="text-5xl sm:text-6xl" aria-hidden="true">
						🎭
					</div>
					<h1 className="mt-6 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
						<span className="text-emerald-600">My Call Time</span>
					</h1>
					<p className="mt-4 text-xl font-medium text-slate-600 sm:text-2xl">
						Never miss your call time
					</p>
					<p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500">
						Stop juggling group texts and spreadsheets. My Call Time makes scheduling rehearsals,
						finding availability, and managing shows effortless.
					</p>
					<div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
						<Link
							to="/signup"
							className="rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30"
						>
							Get Started Free
						</Link>
						<Link
							to="/login"
							className="rounded-xl border-2 border-slate-300 px-8 py-3.5 text-base font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
						>
							Sign In
						</Link>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="py-20">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<h2 className="text-3xl font-bold text-slate-900">Everything your ensemble needs</h2>
						<p className="mt-4 text-lg text-slate-500">
							Simple tools that make group scheduling actually work.
						</p>
					</div>
					<div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
						{features.map((f) => (
							<div
								key={f.title}
								className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md"
							>
								<div className="text-4xl">{f.emoji}</div>
								<h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
								<p className="mt-2 text-sm leading-relaxed text-slate-500">{f.description}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Social Proof */}
			<section className="border-t border-slate-200 bg-slate-50 py-16">
				<div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
					<p className="text-lg font-medium text-slate-600">
						Built by improvisers, for improvisers
					</p>
					<p className="mt-2 text-sm text-slate-400">Free to use · No credit card required</p>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-slate-200 bg-white py-8">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
						<p className="text-sm text-slate-400">© 2026 My Call Time</p>
						<div className="flex gap-6">
							{supportUrl && (
								<a
									href={supportUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm text-slate-400 transition-colors hover:text-slate-600"
								>
									☕ Buy me a coffee
								</a>
							)}
							<a
								href="https://github.com/TylerLeonhardt/greenroom"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-slate-400 transition-colors hover:text-slate-600"
							>
								GitHub
							</a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
