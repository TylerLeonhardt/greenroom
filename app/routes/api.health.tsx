import type { LoaderFunctionArgs } from "@remix-run/node";
import { sql } from "drizzle-orm";
import { logger } from "~/services/logger.server";
import { db } from "../../src/db/index.js";

export async function loader(_args: LoaderFunctionArgs) {
	let dbStatus: "connected" | "disconnected" = "disconnected";

	try {
		const timeout = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("Health check timeout")), 2000),
		);
		await Promise.race([db.execute(sql`SELECT 1`), timeout]);
		dbStatus = "connected";
	} catch (error) {
		logger.error({ err: error }, "Health check: database unreachable");
	}

	if (dbStatus === "disconnected") {
		return Response.json(
			{
				status: "degraded",
				db: "disconnected",
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
