import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
	return [{ title: "Groups — GreenRoom" }];
};

export default function Groups() {
	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Your Groups</h1>
					<p className="mt-2 text-gray-600">Manage your improv groups</p>
				</div>
				<Link
					to="/groups/join"
					className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Join Group
				</Link>
			</div>
			<div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-sm text-gray-500">No groups yet — create or join one to get started</p>
			</div>
		</div>
	);
}
