import {
	boolean,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// Enums
export const groupRoleEnum = pgEnum("group_role", ["admin", "member"]);
export const availabilityStatusEnum = pgEnum("availability_status", ["open", "closed"]);
export const availabilityResponseEnum = pgEnum("availability_response_value", [
	"available",
	"maybe",
	"not_available",
]);
export const eventTypeEnum = pgEnum("event_type", ["rehearsal", "show", "other"]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
	"pending",
	"confirmed",
	"declined",
]);

// Users
export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: varchar("email", { length: 255 }).notNull().unique(),
		passwordHash: text("password_hash"),
		name: varchar("name", { length: 255 }).notNull(),
		profileImage: text("profile_image"),
		googleId: varchar("google_id", { length: 255 }).unique(),
		emailVerified: boolean("email_verified").default(false).notNull(),
		timezone: varchar("timezone", { length: 100 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("users_email_idx").on(table.email),
		index("users_google_id_idx").on(table.googleId),
	],
);

// Groups
export const groups = pgTable(
	"groups",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		inviteCode: varchar("invite_code", { length: 8 }).notNull().unique(),
		createdById: uuid("created_by_id")
			.notNull()
			.references(() => users.id),
		membersCanCreateRequests: boolean("members_can_create_requests").default(false).notNull(),
		membersCanCreateEvents: boolean("members_can_create_events").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("groups_invite_code_idx").on(table.inviteCode)],
);

// Group Memberships
export const groupMemberships = pgTable(
	"group_memberships",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		groupId: uuid("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: groupRoleEnum("role").default("member").notNull(),
		joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("group_memberships_group_user_idx").on(table.groupId, table.userId),
		index("group_memberships_user_id_idx").on(table.userId),
	],
);

// Availability Requests
export const availabilityRequests = pgTable(
	"availability_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		groupId: uuid("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description"),
		dateRangeStart: timestamp("date_range_start", { withTimezone: true }).notNull(),
		dateRangeEnd: timestamp("date_range_end", { withTimezone: true }).notNull(),
		requestedDates: jsonb("requested_dates").$type<string[]>().notNull(),
		requestedStartTime: varchar("requested_start_time", { length: 5 }),
		requestedEndTime: varchar("requested_end_time", { length: 5 }),
		status: availabilityStatusEnum("status").default("open").notNull(),
		createdById: uuid("created_by_id")
			.notNull()
			.references(() => users.id),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
	},
	(table) => [index("availability_requests_group_id_idx").on(table.groupId)],
);

// Availability Responses
export const availabilityResponses = pgTable(
	"availability_responses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		requestId: uuid("request_id")
			.notNull()
			.references(() => availabilityRequests.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		responses: jsonb("responses")
			.$type<Record<string, "available" | "maybe" | "not_available">>()
			.notNull(),
		respondedAt: timestamp("responded_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("availability_responses_request_user_idx").on(table.requestId, table.userId),
	],
);

// Events
export const events = pgTable(
	"events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		groupId: uuid("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description"),
		eventType: eventTypeEnum("event_type").default("other").notNull(),
		startTime: timestamp("start_time", { withTimezone: true }).notNull(),
		endTime: timestamp("end_time", { withTimezone: true }).notNull(),
		location: varchar("location", { length: 500 }),
		createdById: uuid("created_by_id")
			.notNull()
			.references(() => users.id),
		createdFromRequestId: uuid("created_from_request_id").references(() => availabilityRequests.id),
		callTime: timestamp("call_time", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("events_group_start_time_idx").on(table.groupId, table.startTime)],
);

// Event Assignments
export const eventAssignments = pgTable(
	"event_assignments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: varchar("role", { length: 100 }),
		status: assignmentStatusEnum("status").default("pending").notNull(),
		assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("event_assignments_event_user_idx").on(table.eventId, table.userId),
		index("event_assignments_user_id_idx").on(table.userId),
	],
);
