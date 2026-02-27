import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
	return [{ title: "Sign Up — GreenRoom" }];
};

export default function Signup() {
	return (
		<div className="flex flex-col items-center justify-center py-12">
			<h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
			<p className="mt-2 text-gray-600">Join GreenRoom and start scheduling</p>
			<div className="mt-8 w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-center text-sm text-gray-500">
					Registration coming soon — Google OAuth + email/password
				</p>
			</div>
		</div>
	);
}
