import type { MetaFunction } from "@remix-run/node";
import { Link, useParams } from "@remix-run/react";

export const meta: MetaFunction = () => {
	return [{ title: "Group — GreenRoom" }];
};

export default function GroupDetail() {
	const { groupId } = useParams();

	return (
		<div>
			<h1 className="text-3xl font-bold text-gray-900">Group Detail</h1>
			<p className="mt-2 text-gray-600">Group ID: {groupId}</p>
			<div className="mt-6 flex gap-4">
				<Link
					to={`/groups/${groupId}/availability`}
					className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Availability
				</Link>
				<Link
					to={`/groups/${groupId}/events`}
					className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Events
				</Link>
			</div>
			<div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-sm text-gray-500">Group detail content coming soon</p>
			</div>
		</div>
	);
}
