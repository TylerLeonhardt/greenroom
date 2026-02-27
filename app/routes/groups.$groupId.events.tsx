import type { MetaFunction } from "@remix-run/node";
import { useParams } from "@remix-run/react";

export const meta: MetaFunction = () => {
	return [{ title: "Events — GreenRoom" }];
};

export default function Events() {
	const { groupId } = useParams();

	return (
		<div>
			<h1 className="text-3xl font-bold text-gray-900">Events</h1>
			<p className="mt-2 text-gray-600">Upcoming events for group {groupId}</p>
			<div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-sm text-gray-500">No events scheduled yet</p>
			</div>
		</div>
	);
}
