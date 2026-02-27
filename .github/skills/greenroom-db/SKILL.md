---
name: greenroom-db
description: GreenRoom database schema, Drizzle ORM patterns, and migration workflow
---

# GreenRoom Database Layer

## Schema Reference

The entire schema lives in `src/db/schema.ts`. The database connection is in `src/db/index.ts`.

### Connection Setup

```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
```

### Enums

```typescript
export const groupRoleEnum = pgEnum("group_role", ["admin", "member"]);
export const availabilityStatusEnum = pgEnum("availability_status", ["open", "closed"]);
export const availabilityResponseEnum = pgEnum("availability_response_value", ["available", "maybe", "not_available"]);
export const eventTypeEnum = pgEnum("event_type", ["rehearsal", "show", "other"]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["pending", "confirmed", "declined"]);
```

### Users Table

```typescript
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash"),              // null for Google-only users
    name: varchar("name", { length: 255 }).notNull(),
    profileImage: text("profile_image"),
    googleId: varchar("google_id", { length: 255 }).unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_google_id_idx").on(table.googleId),
  ],
);
```

### Groups Table

```typescript
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    inviteCode: varchar("invite_code", { length: 8 }).notNull().unique(),
    createdById: uuid("created_by_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("groups_invite_code_idx").on(table.inviteCode)],
);
```

### Group Memberships Table

```typescript
export const groupMemberships = pgTable(
  "group_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: groupRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("group_memberships_group_user_idx").on(table.groupId, table.userId),
    index("group_memberships_user_id_idx").on(table.userId),
  ],
);
```

### Availability Requests Table

```typescript
export const availabilityRequests = pgTable(
  "availability_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    dateRangeStart: timestamp("date_range_start", { withTimezone: true }).notNull(),
    dateRangeEnd: timestamp("date_range_end", { withTimezone: true }).notNull(),
    requestedDates: jsonb("requested_dates").$type<string[]>().notNull(),    // ["2025-03-15", "2025-03-16"]
    status: availabilityStatusEnum("status").default("open").notNull(),
    createdById: uuid("created_by_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [index("availability_requests_group_id_idx").on(table.groupId)],
);
```

### Availability Responses Table

```typescript
export const availabilityResponses = pgTable(
  "availability_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => availabilityRequests.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    responses: jsonb("responses").$type<Record<string, "available" | "maybe" | "not_available">>().notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("availability_responses_request_user_idx").on(table.requestId, table.userId),
  ],
);
```

### Events Table

```typescript
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    eventType: eventTypeEnum("event_type").default("other").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    location: varchar("location", { length: 500 }),
    createdById: uuid("created_by_id").notNull().references(() => users.id),
    createdFromRequestId: uuid("created_from_request_id").references(() => availabilityRequests.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("events_group_start_time_idx").on(table.groupId, table.startTime)],
);
```

### Event Assignments Table

```typescript
export const eventAssignments = pgTable(
  "event_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 100 }),
    status: assignmentStatusEnum("status").default("pending").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_assignments_event_user_idx").on(table.eventId, table.userId),
    index("event_assignments_user_id_idx").on(table.userId),
  ],
);
```

## Entity Relationship Diagram

```
users
  ├── groups (createdById)
  ├── group_memberships (userId) ←→ groups (groupId)
  ├── availability_requests (createdById) → groups (groupId)
  ├── availability_responses (userId) → availability_requests (requestId)
  ├── events (createdById) → groups (groupId)
  │                        → availability_requests (createdFromRequestId, optional)
  └── event_assignments (userId) → events (eventId)
```

## Creating New Tables

1. Add table definition in `src/db/schema.ts` following the existing pattern:

```typescript
export const newTable = pgTable(
  "new_table",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    // ... columns
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("new_table_group_id_idx").on(table.groupId),
  ],
);
```

2. Generate migration: `pnpm run db:generate`
3. Review the generated SQL in `drizzle/`
4. Run migration: `pnpm run db:migrate`

### Schema Conventions

- All PKs: `uuid("id").defaultRandom().primaryKey()`
- All timestamps: `timestamp("col", { withTimezone: true })`
- All tables have `createdAt`, most have `updatedAt`
- Foreign keys to groups use `onDelete: "cascade"` (deleting a group removes all its data)
- Foreign keys to `createdById` use default `onDelete: "no action"` (preserve creator reference)
- String lengths: `varchar(255)` for names/titles, `varchar(500)` for locations, `text` for descriptions
- Indexes on every foreign key used in WHERE clauses
- Unique indexes for natural compound keys (e.g., group+user membership)

## JSON Column Patterns

Two tables use JSONB columns:

### `availability_requests.requestedDates`

Type: `string[]` — Array of ISO date strings selected by the admin.

```typescript
requestedDates: jsonb("requested_dates").$type<string[]>().notNull()
// Value: ["2025-03-15", "2025-03-16", "2025-03-17"]
```

Iterated in application code to build the availability grid and results heatmap.

### `availability_responses.responses`

Type: `Record<string, "available" | "maybe" | "not_available">` — Map of date string to status.

```typescript
responses: jsonb("responses").$type<Record<string, "available" | "maybe" | "not_available">>().notNull()
// Value: { "2025-03-15": "available", "2025-03-16": "maybe", "2025-03-17": "not_available" }
```

Aggregated in `getAggregatedResults()` by iterating all responses and counting statuses per date. Score formula: `available × 2 + maybe × 1`.

## Index Strategy

- **Primary lookups:** UUID PKs on every table
- **Membership checks:** `group_memberships_group_user_idx` (unique) — fast `isGroupMember()` / `isGroupAdmin()` lookups
- **User's groups:** `group_memberships_user_id_idx` — `getUserGroups()` queries
- **Group data:** `availability_requests_group_id_idx`, `events_group_start_time_idx` (composite for time-ordered group event queries)
- **Unique constraints:** `availability_responses_request_user_idx`, `event_assignments_event_user_idx` — support upsert/conflict resolution
- **Invite codes:** `groups_invite_code_idx` — fast lookup for `joinGroup()`

## Multi-Tenancy Approach

GreenRoom uses **application-layer tenant isolation**, not PostgreSQL RLS:

1. Every request validates group membership via `requireGroupMember()` / `requireGroupAdmin()`
2. Every service function filters by `groupId` in WHERE clauses
3. Cross-resource access is validated (e.g., `event.groupId !== params.groupId` → 404)
4. The dashboard uses JOIN through `group_memberships` to only show the user's data

This means: **never write a query that returns data without filtering by groupId** (or going through the user's group memberships).

## Common Query Patterns

### Parallel Dashboard Queries

```typescript
const [groups, events, requests, confirmations] = await Promise.all([
  db.select({ ... }).from(groupMemberships).innerJoin(groups, ...).where(eq(groupMemberships.userId, userId)),
  db.select({ ... }).from(events).innerJoin(groups, ...).innerJoin(groupMemberships, ...).where(gte(events.startTime, new Date())),
  db.select({ ... }).from(availabilityRequests).where(and(eq(status, "open"), sql`not exists (...)`)),
  db.select({ ... }).from(eventAssignments).where(and(eq(userId, userId), eq(status, "pending"))),
]);
```

### Conditional WHERE Clauses

```typescript
const conditions = [eq(events.groupId, groupId)];
if (options?.upcoming) conditions.push(gte(events.startTime, new Date()));
if (options?.eventType) conditions.push(eq(events.eventType, options.eventType));
const rows = await db.select({ ... }).from(events).where(and(...conditions));
```

### NOT EXISTS Subquery

```typescript
sql`not exists (
  select 1 from availability_responses ar
  where ar.request_id = ${availabilityRequests.id}
  and ar.user_id = ${userId}
)`
```
