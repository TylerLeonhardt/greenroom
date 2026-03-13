import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const TEST_DB = "greenroom_test";
const ADMIN_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
const TEST_URL = `postgresql://postgres:postgres@localhost:5432/${TEST_DB}`;

export async function setup() {
	// 1. Create test database if it doesn't exist
	const adminPool = new pg.Pool({ connectionString: ADMIN_URL });
	try {
		const result = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB]);
		if (result.rowCount === 0) {
			await adminPool.query(`CREATE DATABASE ${TEST_DB}`);
			console.log(`Created database ${TEST_DB}`);
		}
	} finally {
		await adminPool.end();
	}

	// 2. Run Drizzle migrations
	const testPool = new pg.Pool({ connectionString: TEST_URL });
	const db = drizzle(testPool);
	try {
		await migrate(db, { migrationsFolder: "./drizzle" });
		console.log("Migrations applied to test database.");
	} finally {
		await testPool.end();
	}
}

export async function teardown() {
	// Leave the database for faster re-runs; migrations are idempotent
}
