import type { LoaderFunctionArgs } from "@remix-run/node";
import { sql } from "drizzle-orm";
import { logger } from "~/services/logger.server";
import { db } from "../../src/db/index.js";

export async function loader(_args: LoaderFunctionArgs) {
	try {
		const timeout = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("Health check timeout")), 2000),
		);
		await Promise.race([db.execute(sql`SELECT 1`), timeout]);
	} catch (error) {
		logger.error({ err: error, route: "api.health" }, "Health check: database unreachable");
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		return Response.json(
			{
				status: "degraded",
				db: "unreachable",
				error: errorMessage,
				timestamp: new Date().toISOString(),
			},
			{ status: 503 },
		);
	}

	return Response.json({
		status: "ok",
		db: "connected",
		timestamp: new Date().toISOString(),
	});
}
