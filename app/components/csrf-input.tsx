import { useRouteLoaderData } from "@remix-run/react";

export function CsrfInput() {
	const rootData = useRouteLoaderData("root") as { csrfToken?: string } | undefined;
	return <input type="hidden" name="_csrf" value={rootData?.csrfToken ?? ""} />;
}
