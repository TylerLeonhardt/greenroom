import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
	return [{ title: "New Availability Request — GreenRoom" }];
};

export default function NewAvailabilityRequest() {
	return (
		<div>
			<h1 className="text-3xl font-bold text-gray-900">Create Availability Request</h1>
			<p className="mt-2 text-gray-600">Ask your group when they&apos;re free</p>
			<div className="mt-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-sm text-gray-500">Availability request form coming soon</p>
			</div>
		</div>
	);
}
