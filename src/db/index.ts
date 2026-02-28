import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
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
});

export const db = drizzle(pool, { schema });
