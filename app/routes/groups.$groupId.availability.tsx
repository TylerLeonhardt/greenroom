import type { MetaFunction } from "@remix-run/node";
import { Link, useParams } from "@remix-run/react";

export const meta: MetaFunction = () => {
	return [{ title: "Availability — GreenRoom" }];
};

export default function Availability() {
	const { groupId } = useParams();

	return (
		<div>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">Availability Requests</h1>
					<p className="mt-2 text-gray-600">Manage scheduling polls for your group</p>
				</div>
				<Link
					to={`/groups/${groupId}/availability/new`}
					className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
				>
					New Request
				</Link>
			</div>
			<div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-sm text-gray-500">No availability requests yet</p>
			</div>
		</div>
	);
}
