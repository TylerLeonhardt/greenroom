import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
	return [{ title: "Dashboard — GreenRoom" }];
};

export default function Dashboard() {
	return (
		<div>
			<h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
			<p className="mt-2 text-gray-600">Your upcoming events and group activity</p>
			<div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-sm text-gray-500">Dashboard content coming soon</p>
			</div>
		</div>
	);
}
