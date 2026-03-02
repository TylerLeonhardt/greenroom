import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { CalendarDays, ClipboardList, Users } from "lucide-react";
import { requireAdmin } from "~/services/admin.server";
import { getAnalytics } from "~/services/analytics.server";

export const meta: MetaFunction = () => {
	return [{ title: "Admin Dashboard — My Call Time" }];
};

const VALID_WINDOWS = [7, 30, 90];

export async function loader({ request }: LoaderFunctionArgs) {
	await requireAdmin(request);
	const url = new URL(request.url);
	const windowParam = Number(url.searchParams.get("window"));
	const windowDays = VALID_WINDOWS.includes(windowParam) ? windowParam : 30;
	const analytics = await getAnalytics(windowDays);
	return { analytics };
}

interface MetricCardProps {
	title: string;
	total: number;
	windowed: number;
	windowDays: number;
	icon: React.ReactNode;
}

function MetricCard({ title, total, windowed, windowDays, icon }: MetricCardProps) {
	return (
		<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
					{icon}
				</div>
				<h3 className="text-sm font-medium text-slate-600">{title}</h3>
			</div>
			<p className="mt-3 text-3xl font-bold text-slate-900">{total.toLocaleString()}</p>
			<p className="mt-1 text-sm text-emerald-600">
				+{windowed.toLocaleString()} in last {windowDays}d
			</p>
		</div>
	);
}

export default function AdminDashboard() {
	const { analytics } = useLoaderData<typeof loader>();
	const [searchParams, setSearchParams] = useSearchParams();
	const activeWindow = Number(searchParams.get("window")) || 30;

	return (
		<div>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
					<p className="mt-1 text-slate-600">Platform usage metrics at a glance.</p>
				</div>
				<div className="flex gap-2">
					{VALID_WINDOWS.map((w) => (
						<button
							key={w}
							type="button"
							onClick={() => setSearchParams({ window: String(w) })}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
								activeWindow === w
									? "bg-emerald-600 text-white"
									: "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
							}`}
						>
							{w}d
						</button>
					))}
				</div>
			</div>

			<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<MetricCard
					title="Total Users"
					total={analytics.totalUsers}
					windowed={analytics.newUsers}
					windowDays={analytics.windowDays}
					icon={<Users className="h-5 w-5" />}
				/>
				<MetricCard
					title="Availability Requests"
					total={analytics.totalAvailabilityRequests}
					windowed={analytics.newAvailabilityRequests}
					windowDays={analytics.windowDays}
					icon={<ClipboardList className="h-5 w-5" />}
				/>
				<MetricCard
					title="Events"
					total={analytics.totalEvents}
					windowed={analytics.newEvents}
					windowDays={analytics.windowDays}
					icon={<CalendarDays className="h-5 w-5" />}
				/>
			</div>
		</div>
	);
}
