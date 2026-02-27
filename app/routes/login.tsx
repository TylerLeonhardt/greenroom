import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
	return [{ title: "Login — GreenRoom" }];
};

export default function Login() {
	return (
		<div className="flex flex-col items-center justify-center py-12">
			<h1 className="text-3xl font-bold text-gray-900">Sign In</h1>
			<p className="mt-2 text-gray-600">Welcome back to GreenRoom</p>
			<div className="mt-8 w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
				<p className="text-center text-sm text-gray-500">
					Authentication coming soon — Google OAuth + email/password
				</p>
			</div>
		</div>
	);
}
