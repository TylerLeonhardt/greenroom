import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

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

const db = drizzle(pool);

try {
	console.log("Running database migrations...");
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("Migrations applied successfully.");
} catch (error) {
	console.error("Migration failed:", error);
	process.exit(1);
} finally {
	await pool.end();
}
