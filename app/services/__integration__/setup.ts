/**
 * Integration test helpers — shared across all *.integration.test.ts files.
 *
 * Provides database cleanup (TRUNCATE CASCADE) and pool shutdown.
 * The `db` instance comes from the production module (src/db/index.ts),
 * which reads DATABASE_URL — vitest.integration.config.ts sets it to greenroom_test.
 */
import { sql } from "drizzle-orm";
import { db } from "../../../src/db/index.js";

const TABLES = [
	"rsvp_changes",
	"event_assignments",
	"events",
	"availability_responses",
	"availability_requests",
	"group_memberships",
	"groups",
	"users",
];

/** Truncate every application table. Order doesn't matter because CASCADE is used. */
export async function cleanDatabase(): Promise<void> {
	await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} CASCADE`));
}
