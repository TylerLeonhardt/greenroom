import type { MetaFunction } from "@remix-run/node";
import { useParams } from "@remix-run/react";

export const meta: MetaFunction = () => {
	return [{ title: "Event Detail — GreenRoom" }];
};

export default function EventDetail() {
	const { eventId } = useParams();

	return (
		<div>
			<h1 className="text-3xl font-bold text-gray-900">Event Detail</h1>
			<p className="mt-2 text-gray-600">Event ID: {eventId}</p>
			<div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-sm text-gray-500">Event details coming soon</p>
			</div>
		</div>
	);
}
