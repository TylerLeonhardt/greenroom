import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const TEST_PASSWORD = "TestPassword123!";

export interface TestUser {
	id: string;
	email: string;
	name: string;
	password: string;
}

export interface TestGroup {
	id: string;
	name: string;
	inviteCode: string;
}

export interface TestAvailabilityRequest {
	id: string;
	title: string;
	dates: string[];
}

export interface TestData {
	admin: TestUser;
	member: TestUser;
	group: TestGroup;
	availabilityRequest: TestAvailabilityRequest;
	cleanup: () => Promise<void>;
}

function getPool(): pg.Pool {
	return new pg.Pool({
		connectionString:
			process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/greenroom",
	});
}

/**
 * Generate a unique 8-character invite code from the allowed character set.
 * Uses the same character set as the app (no ambiguous I/O/0/1).
 */
function generateTestInviteCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "TE"; // Prefix to identify test invite codes
	for (let i = 0; i < 6; i++) {
		code += chars[crypto.randomInt(chars.length)];
	}
	return code;
}

/**
 * Seeds the test database with an admin user, a member user, and a group.
 * All users have email_verified = true and a known password.
 *
 * @param prefix - Unique prefix for this test run (use test file name or describe block)
 */
export async function seedTestData(prefix: string): Promise<TestData> {
	const pool = getPool();
	const suffix = Date.now().toString(36);

	const adminId = crypto.randomUUID();
	const memberId = crypto.randomUUID();
	const groupId = crypto.randomUUID();
	const membershipAdminId = crypto.randomUUID();
	const membershipMemberId = crypto.randomUUID();
	const availabilityRequestId = crypto.randomUUID();
	const inviteCode = generateTestInviteCode();

	const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 10);

	const admin: TestUser = {
		id: adminId,
		email: `e2e-admin-${prefix}-${suffix}@test.local`,
		name: `Admin ${prefix}`,
		password: TEST_PASSWORD,
	};

	const member: TestUser = {
		id: memberId,
		email: `e2e-member-${prefix}-${suffix}@test.local`,
		name: `Member ${prefix}`,
		password: TEST_PASSWORD,
	};

	const group: TestGroup = {
		id: groupId,
		name: `Test Group ${prefix}`,
		inviteCode,
	};

	// Generate future dates for availability request
	const requestDates: string[] = [];
	for (let i = 7; i <= 14; i++) {
		const d = new Date();
		d.setDate(d.getDate() + i);
		requestDates.push(d.toISOString().split("T")[0]);
	}
	const availabilityRequest: TestAvailabilityRequest = {
		id: availabilityRequestId,
		title: `E2E Availability ${prefix}`,
		dates: requestDates,
	};

	// Clean up any stale test data from previous runs with same prefix
	// Delete groups created by e2e users (from "Create Group" tests) and named test groups
	const userPattern = `e2e-%-${prefix}-%@test.local`;
	const groupName = `Test Group ${prefix}`;

	// First clean child records for groups created by e2e users
	await pool.query(
		`DELETE FROM availability_responses WHERE request_id IN (
			SELECT id FROM availability_requests WHERE group_id IN (
				SELECT id FROM groups WHERE name = $1 OR created_by_id IN (SELECT id FROM users WHERE email LIKE $2)
			)
		)`,
		[groupName, userPattern],
	);
	await pool.query(
		`DELETE FROM event_assignments WHERE event_id IN (
			SELECT id FROM events WHERE group_id IN (
				SELECT id FROM groups WHERE name = $1 OR created_by_id IN (SELECT id FROM users WHERE email LIKE $2)
			)
		)`,
		[groupName, userPattern],
	);
	await pool.query(
		`DELETE FROM events WHERE group_id IN (
			SELECT id FROM groups WHERE name = $1 OR created_by_id IN (SELECT id FROM users WHERE email LIKE $2)
		)`,
		[groupName, userPattern],
	);
	await pool.query(
		`DELETE FROM availability_requests WHERE group_id IN (
			SELECT id FROM groups WHERE name = $1 OR created_by_id IN (SELECT id FROM users WHERE email LIKE $2)
		)`,
		[groupName, userPattern],
	);
	await pool.query(
		`DELETE FROM group_memberships WHERE group_id IN (
			SELECT id FROM groups WHERE name = $1 OR created_by_id IN (SELECT id FROM users WHERE email LIKE $2)
		)`,
		[groupName, userPattern],
	);
	await pool.query(
		`DELETE FROM group_memberships WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
		[userPattern],
	);
	await pool.query(
		`DELETE FROM groups WHERE name = $1 OR created_by_id IN (SELECT id FROM users WHERE email LIKE $2)`,
		[groupName, userPattern],
	);
	await pool.query(`DELETE FROM users WHERE email LIKE $1`, [userPattern]);

	// Insert users
	await pool.query(
		`INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
		[adminId, admin.email, passwordHash, admin.name],
	);
	await pool.query(
		`INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
		[memberId, member.email, passwordHash, member.name],
	);

	// Insert group
	await pool.query(
		`INSERT INTO groups (id, name, invite_code, created_by_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
		[groupId, group.name, inviteCode, adminId],
	);

	// Insert memberships
	await pool.query(
		`INSERT INTO group_memberships (id, group_id, user_id, role, joined_at)
		 VALUES ($1, $2, $3, 'admin', NOW())`,
		[membershipAdminId, groupId, adminId],
	);
	await pool.query(
		`INSERT INTO group_memberships (id, group_id, user_id, role, joined_at)
		 VALUES ($1, $2, $3, 'member', NOW())`,
		[membershipMemberId, groupId, memberId],
	);

	// Insert availability request
	await pool.query(
		`INSERT INTO availability_requests (id, group_id, title, date_range_start, date_range_end, requested_dates, status, created_by_id, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, NOW())`,
		[
			availabilityRequestId,
			groupId,
			availabilityRequest.title,
			`${requestDates[0]}T00:00:00Z`,
			`${requestDates[requestDates.length - 1]}T00:00:00Z`,
			JSON.stringify(requestDates),
			adminId,
		],
	);

	// Close the seeding pool — cleanup will create its own if needed
	await pool.end();

	const cleanup = async () => {
		const cleanupPool = getPool();
		try {
			// Clean up in reverse dependency order
			await cleanupPool.query(
				`DELETE FROM availability_responses WHERE request_id IN (
					SELECT id FROM availability_requests WHERE group_id = $1
				)`,
				[groupId],
			);
			await cleanupPool.query(
				`DELETE FROM event_assignments WHERE event_id IN (
					SELECT id FROM events WHERE group_id = $1
				)`,
				[groupId],
			);
			await cleanupPool.query(`DELETE FROM events WHERE group_id = $1`, [groupId]);
			await cleanupPool.query(`DELETE FROM availability_requests WHERE group_id = $1`, [groupId]);
			await cleanupPool.query(`DELETE FROM group_memberships WHERE group_id = $1`, [groupId]);
			await cleanupPool.query(`DELETE FROM groups WHERE id = $1`, [groupId]);
			await cleanupPool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [adminId, memberId]);
		} finally {
			await cleanupPool.end();
		}
	};

	return { admin, member, group, availabilityRequest, cleanup };
}

/**
 * Seeds an extra standalone user (not in any group).
 * Useful for testing join flows where a fresh user needs to join a group.
 */
export async function seedStandaloneUser(
	prefix: string,
): Promise<{ user: TestUser; cleanup: () => Promise<void> }> {
	const pool = getPool();
	const suffix = Date.now().toString(36);
	const userId = crypto.randomUUID();
	const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 10);

	const user: TestUser = {
		id: userId,
		email: `e2e-solo-${prefix}-${suffix}@test.local`,
		name: `Solo ${prefix}`,
		password: TEST_PASSWORD,
	};

	// Clean up stale test data — including groups created by solo user
	const soloPattern = `e2e-solo-${prefix}-%@test.local`;
	await pool.query(
		`DELETE FROM group_memberships WHERE group_id IN (
			SELECT id FROM groups WHERE created_by_id IN (SELECT id FROM users WHERE email LIKE $1)
		)`,
		[soloPattern],
	);
	await pool.query(
		`DELETE FROM group_memberships WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
		[soloPattern],
	);
	await pool.query(
		`DELETE FROM groups WHERE created_by_id IN (SELECT id FROM users WHERE email LIKE $1)`,
		[soloPattern],
	);
	await pool.query(`DELETE FROM users WHERE email LIKE $1`, [soloPattern]);

	await pool.query(
		`INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
		[userId, user.email, passwordHash, user.name],
	);

	// Close the seeding pool — cleanup will create its own if needed
	await pool.end();

	const cleanup = async () => {
		const cleanupPool = getPool();
		try {
			await cleanupPool.query(`DELETE FROM group_memberships WHERE user_id = $1`, [userId]);
			await cleanupPool.query(`DELETE FROM users WHERE id = $1`, [userId]);
		} finally {
			await cleanupPool.end();
		}
	};

	return { user, cleanup };
}
