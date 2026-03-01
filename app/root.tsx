import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
	Form,
	isRouteErrorResponse,
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useLocation,
	useNavigation,
	useRouteError,
} from "@remix-run/react";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { CsrfInput } from "~/components/csrf-input";
import { getOptionalUser } from "~/services/auth.server";
import { generateCsrfToken } from "~/services/csrf.server";
import stylesheet from "./tailwind.css?url";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: stylesheet },
	{
		rel: "icon",
		href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎭</text></svg>",
	},
];

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getOptionalUser(request);
	const { token: csrfToken, cookie } = await generateCsrfToken(request);
	const supportUrl = process.env.SUPPORT_URL || null;
	return Response.json({ user, csrfToken, supportUrl }, { headers: { "Set-Cookie": cookie } });
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
	const location = useLocation();
	const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
	return (
		<Link
			to={to}
			className={`text-sm transition-colors ${
				isActive ? "font-medium text-emerald-600" : "text-slate-600 hover:text-slate-900"
			}`}
		>
			{children}
		</Link>
	);
}

function UserAvatar({ name }: { name: string }) {
	const initials = name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	return (
		<div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
			{initials}
		</div>
	);
}

function NavBar() {
	const { user } = useLoaderData<typeof loader>();
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<nav className="border-b border-slate-200 bg-white shadow-sm">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<Link to="/" className="text-xl font-bold text-emerald-600">
					🎭 My Call Time
				</Link>

				{/* Desktop nav */}
				<div className="hidden items-center gap-4 sm:flex">
					{user ? (
						<>
							<NavLink to="/dashboard">Dashboard</NavLink>
							<NavLink to="/groups">Groups</NavLink>
							<NavLink to="/settings">Settings</NavLink>
							<div className="ml-2 flex items-center gap-3 border-l border-slate-200 pl-4">
								<UserAvatar name={user.name} />
								<span className="text-sm font-medium text-slate-700">{user.name}</span>
								<Form method="post" action="/logout">
									<CsrfInput />
									<button
										type="submit"
										className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
									>
										Log out
									</button>
								</Form>
							</div>
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

				{/* Mobile hamburger */}
				<button
					type="button"
					onClick={() => setMobileOpen(!mobileOpen)}
					className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 sm:hidden"
					aria-label="Toggle menu"
				>
					{mobileOpen ? (
						<X className="pointer-events-none h-5 w-5" />
					) : (
						<Menu className="pointer-events-none h-5 w-5" />
					)}
				</button>
			</div>

			{/* Mobile menu */}
			{mobileOpen && (
				<div className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 sm:hidden">
					{user ? (
						<div className="space-y-1">
							<div className="mb-2 flex items-center gap-3 border-b border-slate-100 pb-3">
								<UserAvatar name={user.name} />
								<span className="text-sm font-medium text-slate-900">{user.name}</span>
							</div>
							<Link
								to="/dashboard"
								className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
								onClick={() => setMobileOpen(false)}
							>
								Dashboard
							</Link>
							<Link
								to="/groups"
								className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
								onClick={() => setMobileOpen(false)}
							>
								Groups
							</Link>
							<Link
								to="/settings"
								className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
								onClick={() => setMobileOpen(false)}
							>
								Settings
							</Link>
							<Form method="post" action="/logout">
								<CsrfInput />
								<button
									type="submit"
									className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
								>
									Log out
								</button>
							</Form>
						</div>
					) : (
						<div className="space-y-2">
							<Link
								to="/login"
								className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
								onClick={() => setMobileOpen(false)}
							>
								Login
							</Link>
							<Link
								to="/signup"
								className="block rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-emerald-700"
								onClick={() => setMobileOpen(false)}
							>
								Sign Up
							</Link>
						</div>
					)}
				</div>
			)}
		</nav>
	);
}

function LoadingBar() {
	const navigation = useNavigation();
	if (navigation.state === "idle") return null;
	return (
		<div className="fixed left-0 right-0 top-0 z-50 h-0.5">
			<div className="h-full animate-pulse bg-emerald-500" />
		</div>
	);
}

function AppFooter() {
	const { supportUrl } = useLoaderData<typeof loader>();
	if (!supportUrl) return null;
	return (
		<footer className="mt-12 border-t border-slate-200 py-6 text-center">
			<a
				href={supportUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="text-sm text-slate-400 transition-colors hover:text-slate-600"
			>
				☕ Buy me a coffee
			</a>
		</footer>
	);
}

export default function App() {
	const location = useLocation();
	const isLanding = location.pathname === "/";

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="min-h-screen bg-slate-50">
				<LoadingBar />
				<NavBar />
				{isLanding ? (
					<Outlet />
				) : (
					<>
						<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
							<Outlet />
						</main>
						<AppFooter />
					</>
				)}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export function ErrorBoundary() {
	const error = useRouteError();
	let title = "Something went wrong";
	let message = "An unexpected error occurred. Please try again.";

	if (isRouteErrorResponse(error)) {
		title = error.status === 404 ? "Page not found" : `Error ${error.status}`;
		message =
			error.status === 404
				? "The page you're looking for doesn't exist or has been moved."
				: error.statusText || message;
	}

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>{title} — My Call Time</title>
				<Links />
			</head>
			<body className="min-h-screen bg-slate-50">
				<nav className="border-b border-slate-200 bg-white shadow-sm">
					<div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
						<a href="/" className="text-xl font-bold text-emerald-600">
							🎭 My Call Time
						</a>
					</div>
				</nav>
				<main className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6 lg:px-8">
					<div className="text-6xl">😬</div>
					<h1 className="mt-6 text-3xl font-bold text-slate-900">{title}</h1>
					<p className="mt-3 text-lg text-slate-500">{message}</p>
					<a
						href="/"
						className="mt-8 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
					>
						Go Home
					</a>
				</main>
				<Scripts />
			</body>
		</html>
	);
}
