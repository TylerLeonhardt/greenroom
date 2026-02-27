import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
	Form,
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "@remix-run/react";
import { getOptionalUser } from "~/services/auth.server";
import stylesheet from "./tailwind.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getOptionalUser(request);
	return { user };
}

function NavBar() {
	const { user } = useLoaderData<typeof loader>();

	return (
		<nav className="border-b border-slate-200 bg-white">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<Link to="/" className="text-xl font-bold text-emerald-600">
					🎭 GreenRoom
				</Link>
				<div className="flex items-center gap-4">
					{user ? (
						<>
							<Link to="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
								Dashboard
							</Link>
							<Link to="/groups" className="text-sm text-slate-600 hover:text-slate-900">
								Groups
							</Link>
							<span className="text-sm font-medium text-slate-700">{user.name}</span>
							<Form method="post" action="/logout">
								<button
									type="submit"
									className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
								>
									Log out
								</button>
							</Form>
						</>
					) : (
						<>
							<Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
								Login
							</Link>
							<Link
								to="/signup"
								className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
							>
								Sign Up
							</Link>
						</>
					)}
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
			<body className="min-h-screen bg-slate-50">
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
