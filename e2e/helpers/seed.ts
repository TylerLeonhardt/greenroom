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
	creatorAvailabilityRequest: TestAvailabilityRequest;
	eventPermissionGroup: TestGroup;
	permissionAvailabilityRequest: TestAvailabilityRequest;
	permissionCreatorAvailabilityRequest: TestAvailabilityRequest;
	cleanup: () => Promise<void>;
}

function getPool(): pg.Pool {
	return new pg.Pool({
		connectionString:
			process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/greenroom",
	});
}

export async function issueTestMagicLink(userId: string): Promise<string> {
	const pool = getPool();
	const rawToken = crypto.randomBytes(32).toString("base64url");
	const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

	try {
		await pool.query(
			`INSERT INTO magic_link_tokens
				(user_id, token_hash, purpose, redirect_path, expires_at)
			VALUES ($1, $2, 'login', '/dashboard', now() + interval '10 minutes')`,
			[userId, tokenHash],
		);
		return rawToken;
	} finally {
		await pool.end();
	}
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

async function cleanupTestNamespaceWithPool(pool: pg.Pool, prefix: string): Promise<void> {
	const userPattern = `e2e-%-${prefix}-%@test.local`;
	const groupName = `Test Group ${prefix}`;

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
}

export async function cleanupTestNamespace(prefix: string): Promise<void> {
	const pool = getPool();
	try {
		await cleanupTestNamespaceWithPool(pool, prefix);
	} finally {
		await pool.end();
	}
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
	const creatorAvailabilityRequestId = crypto.randomUUID();
	const eventPermissionGroupId = crypto.randomUUID();
	const eventPermissionMembershipAdminId = crypto.randomUUID();
	const eventPermissionMembershipMemberId = crypto.randomUUID();
	const permissionAvailabilityRequestId = crypto.randomUUID();
	const permissionCreatorAvailabilityRequestId = crypto.randomUUID();
	const inviteCode = generateTestInviteCode();
	const eventPermissionInviteCode = generateTestInviteCode();

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
	const eventPermissionGroup: TestGroup = {
		id: eventPermissionGroupId,
		name: `Event Permission Group ${prefix}`,
		inviteCode: eventPermissionInviteCode,
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
	const creatorAvailabilityRequest: TestAvailabilityRequest = {
		id: creatorAvailabilityRequestId,
		title: `E2E Member Availability ${prefix}`,
		dates: requestDates,
	};
	const permissionAvailabilityRequest: TestAvailabilityRequest = {
		id: permissionAvailabilityRequestId,
		title: `E2E Permission Availability ${prefix}`,
		dates: requestDates,
	};
	const permissionCreatorAvailabilityRequest: TestAvailabilityRequest = {
		id: permissionCreatorAvailabilityRequestId,
		title: `E2E Permission Member Availability ${prefix}`,
		dates: requestDates,
	};

	// Clean up any stale test data from previous runs with same prefix
	// Delete groups created by e2e users (from "Create Group" tests) and named test groups
	await cleanupTestNamespaceWithPool(pool, prefix);

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
	await pool.query(
		`INSERT INTO groups (id, name, invite_code, created_by_id, members_can_create_events, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
		[eventPermissionGroupId, eventPermissionGroup.name, eventPermissionInviteCode, adminId],
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
	await pool.query(
		`INSERT INTO group_memberships (id, group_id, user_id, role, joined_at)
		 VALUES ($1, $2, $3, 'admin', NOW()), ($4, $2, $5, 'member', NOW())`,
		[
			eventPermissionMembershipAdminId,
			eventPermissionGroupId,
			adminId,
			eventPermissionMembershipMemberId,
			memberId,
		],
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
	await pool.query(
		`INSERT INTO availability_requests (id, group_id, title, date_range_start, date_range_end, requested_dates, status, created_by_id, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, NOW())`,
		[
			creatorAvailabilityRequestId,
			groupId,
			creatorAvailabilityRequest.title,
			`${requestDates[0]}T00:00:00Z`,
			`${requestDates[requestDates.length - 1]}T00:00:00Z`,
			JSON.stringify(requestDates),
			memberId,
		],
	);
	await pool.query(
		`INSERT INTO availability_requests (id, group_id, title, date_range_start, date_range_end, requested_dates, status, created_by_id, created_at)
		 VALUES
			($1, $2, $3, $4, $5, $6, 'open', $7, NOW()),
			($8, $2, $9, $4, $5, $6, 'open', $10, NOW())`,
		[
			permissionAvailabilityRequestId,
			eventPermissionGroupId,
			permissionAvailabilityRequest.title,
			`${requestDates[0]}T00:00:00Z`,
			`${requestDates[requestDates.length - 1]}T00:00:00Z`,
			JSON.stringify(requestDates),
			adminId,
			permissionCreatorAvailabilityRequestId,
			permissionCreatorAvailabilityRequest.title,
			memberId,
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
					SELECT id FROM availability_requests WHERE group_id IN ($1, $2)
				)`,
				[groupId, eventPermissionGroupId],
			);
			await cleanupPool.query(
				`DELETE FROM event_assignments WHERE event_id IN (
					SELECT id FROM events WHERE group_id IN ($1, $2)
				)`,
				[groupId, eventPermissionGroupId],
			);
			await cleanupPool.query(`DELETE FROM events WHERE group_id IN ($1, $2)`, [
				groupId,
				eventPermissionGroupId,
			]);
			await cleanupPool.query(`DELETE FROM availability_requests WHERE group_id IN ($1, $2)`, [
				groupId,
				eventPermissionGroupId,
			]);
			await cleanupPool.query(`DELETE FROM group_memberships WHERE group_id IN ($1, $2)`, [
				groupId,
				eventPermissionGroupId,
			]);
			await cleanupPool.query(`DELETE FROM groups WHERE id IN ($1, $2)`, [
				groupId,
				eventPermissionGroupId,
			]);
			await cleanupPool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [adminId, memberId]);
		} finally {
			await cleanupPool.end();
		}
	};

	return {
		admin,
		member,
		group,
		availabilityRequest,
		creatorAvailabilityRequest,
		eventPermissionGroup,
		permissionAvailabilityRequest,
		permissionCreatorAvailabilityRequest,
		cleanup,
	};
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
