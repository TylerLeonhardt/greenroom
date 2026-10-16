import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { logger } from "../../app/services/logger.server.js";
import * as schema from "./schema.js";

const ssl =
	process.env.NODE_ENV === "production"
		? {
				ca: fs
					.readFileSync(path.join(process.cwd(), "certs", "DigiCertGlobalRootG2.crt.pem"))
					.toString(),
			}
		: undefined;

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
	ssl,
	max: 10,
	idleTimeoutMillis: 10_000,
	connectionTimeoutMillis: 1_000,
});

pool.on("error", (error) => {
	logger.error({ err: error }, "Database pool evicted an errored idle connection");
});

export const db = drizzle(pool, { schema });
