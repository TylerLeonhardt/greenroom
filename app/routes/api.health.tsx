import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader(_args: LoaderFunctionArgs) {
	return Response.json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
}
