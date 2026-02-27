import type { MetaFunction } from "@remix-run/node";
import { useParams } from "@remix-run/react";

export const meta: MetaFunction = () => {
	return [{ title: "Availability Request — GreenRoom" }];
};

export default function AvailabilityRequestDetail() {
	const { requestId } = useParams();

	return (
		<div>
			<h1 className="text-3xl font-bold text-gray-900">Availability Request</h1>
			<p className="mt-2 text-gray-600">Request ID: {requestId}</p>
			<div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-sm text-gray-500">Availability response form coming soon</p>
			</div>
		</div>
	);
}
