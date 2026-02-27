import type { LinksFunction } from "@remix-run/node";
import { Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import stylesheet from "./tailwind.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

function NavBar() {
	return (
		<nav className="border-b border-gray-200 bg-white">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<Link to="/" className="text-xl font-bold text-green-700">
					🎭 GreenRoom
				</Link>
				<div className="flex items-center gap-4">
					<Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
						Dashboard
					</Link>
					<Link to="/groups" className="text-sm text-gray-600 hover:text-gray-900">
						Groups
					</Link>
					<Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
						Login
					</Link>
				</div>
			</div>
		</nav>
	);
}

export default function App() {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="min-h-screen bg-gray-50">
				<NavBar />
				<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					<Outlet />
				</main>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
