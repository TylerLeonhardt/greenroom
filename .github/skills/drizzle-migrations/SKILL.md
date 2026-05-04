---
name: drizzle-migrations
description: Drizzle ORM migration workflow, snapshot chain management, and schema conventions for the My Call Time codebase
---

# Drizzle Migration Patterns

## Migration Workflow

### Overview

Schema changes flow through three steps:

```
src/db/schema.ts  →  pnpm run db:generate  →  drizzle/  →  pnpm run db:migrate
     (edit)              (generate)            (review)         (apply)
```

1. **Edit** `src/db/schema.ts` — the single source of truth for all tables, enums, and indexes
2. **Generate** migration with `pnpm run db:generate` — creates SQL + snapshot in `drizzle/`
3. **Review** the generated SQL — never blindly trust it (see gotchas below)
4. **Apply** locally with `pnpm run db:migrate`
5. **Commit** both the schema change AND the `drizzle/` output

### Drizzle Config

```typescript
// drizzle.config.ts
export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: { url: process.env.DATABASE_URL },
});
```

### Production Migrations

Migrations auto-run on container startup via `scripts/migrate.mjs`:

```javascript
import { migrate } from "drizzle-orm/node-postgres/migrator";
await migrate(db, { migrationsFolder: "./drizzle" });
```

- Idempotent — safe with multiple replicas
- Fails fast on error — prevents app from starting with a broken schema
- Uses the same `pg.Pool` config as the app (SSL in production with DigiCert CA cert)

## The `drizzle/` Directory

```
drizzle/
├── 0000_wise_hammerhead.sql      # Migration SQL files (auto-named)
├── 0001_narrow_liz_osborn.sql
├── ...
├── 0015_sticky_leper_queen.sql   # Latest: calendar_tokens table
└── meta/
    ├── _journal.json             # Migration journal (ordered list of entries)
    ├── 0000_snapshot.json        # Schema snapshot after each migration
    ├── 0001_snapshot.json
    ├── ...
    └── 0015_snapshot.json
```

### Journal (`_journal.json`)

An ordered list of migration entries. Each entry has:
- `idx` — sequential integer (0, 1, 2, ...)
- `tag` — migration name (matches the `.sql` filename)
- `when` — Unix timestamp of generation
- `version` — journal format version (currently `"7"`)

```json
{
  "idx": 15,
  "version": "7",
  "when": 1777905664500,
  "tag": "0015_sticky_leper_queen",
  "breakpoints": true
}
```

### Snapshots

Each snapshot captures the full schema state after that migration. Snapshots form a chain:

```
0012_snapshot.json: { "id": "4957071d-...", "prevId": "8b50307a-..." }
0013_snapshot.json: { "id": "02f0375f-...", "prevId": "4957071d-..." }
```

`prevId` of snapshot N must equal `id` of snapshot N-1. If this chain breaks, `db:generate` may produce incorrect or empty migrations.

### The Snapshot ID Collision Problem

When multiple branches create migrations concurrently (e.g., both branch off the same base and add migration `0012`), they can produce snapshots with **different content but the same index**. When merged:

- The journal may have duplicate `idx` values
- The snapshot chain `prevId → id` can break
- `pnpm run db:generate` silently produces wrong diffs or no-op migrations

**How to detect:** After merging branches that both touched `drizzle/`, check:
1. `_journal.json` has no duplicate `idx` values
2. Each snapshot's `prevId` matches the previous snapshot's `id`
3. Run `pnpm run db:generate` — if it generates a migration on a clean schema, the chain is broken

**How to fix:** If you hit this, the safest approach is:
1. Re-number the colliding migration (rename SQL file and update journal entry)
2. Regenerate the snapshot for the re-numbered migration by running `pnpm run db:generate` from a clean state
3. Verify the chain is intact

**Prevention:** Coordinate with other developers when multiple branches need schema changes. Ideally only one in-flight branch adds migrations at a time.

## Schema Conventions

### Table Definition Pattern

Every table follows this structure:

```typescript
export const tableName = pgTable(
	"table_name",                                    // snake_case DB name
	{
		id: uuid("id").defaultRandom().primaryKey(),   // UUID PK always
		groupId: uuid("group_id")                      // FK example
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 255 }).notNull(),
		// ... other columns ...
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("table_name_group_id_idx").on(table.groupId),
	],
);
```

### Column Conventions

| Convention | Pattern |
|-----------|---------|
| Primary keys | `uuid("id").defaultRandom().primaryKey()` — always UUID |
| Timestamps | `timestamp("col", { withTimezone: true })` — always with timezone |
| Created/Updated | `createdAt` + `updatedAt` with `.defaultNow().notNull()` |
| Soft deletes | `deletedAt: timestamp(...)` — nullable, null means active |
| String lengths | `varchar(255)` for names/titles, `varchar(500)` for locations, `text` for descriptions |
| JSON columns | `jsonb("col").$type<TypeHere>().notNull()` |
| Enums | Define with `pgEnum(...)` at top of schema file |

### Foreign Key Conventions

| Relationship | `onDelete` | Why |
|-------------|-----------|-----|
| Child → parent group | `cascade` | Deleting a group removes all its data |
| Assignment → event/user | `cascade` | Removing event/user cleans up assignments |
| Token → user | `cascade` | Deleting user removes their token |
| Record → creator (`createdById`) | default (`no action`) | Preserve creator reference |

### Uniqueness: `.unique()` vs `uniqueIndex()`

- **Single-column uniqueness:** Use column-level `.unique()` — e.g., `users.email`, `calendarTokens.token`
- **Composite uniqueness:** Use `uniqueIndex(...)` in the table's index callback — e.g., `uniqueIndex("event_assignments_event_user_idx").on(table.eventId, table.userId)`

Both create a DB unique constraint, but `uniqueIndex` is needed for multi-column keys and is the pattern used for upsert conflict targets.

## Adding a New Table — Step by Step

### 1. Define the Table in `src/db/schema.ts`

```typescript
export const myNewTable = pgTable(
	"my_new_table",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" })
			.unique(),                                    // one row per user
		someValue: varchar("some_value", { length: 255 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
);
```

### 2. Generate the Migration

```bash
pnpm run db:generate
```

This creates:
- `drizzle/NNNN_random_name.sql` — the SQL migration
- `drizzle/meta/NNNN_snapshot.json` — updated schema snapshot
- Updated `drizzle/meta/_journal.json` — new entry appended

### 3. Review the Generated SQL

**Always read the migration SQL.** Check for:
- Correct column types and constraints
- `DEFAULT` clauses for NOT NULL columns with existing data
- Foreign key references pointing to the right tables
- Index creation

Example (from `0015_sticky_leper_queen.sql` — the `calendar_tokens` migration):

```sql
CREATE TABLE "calendar_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_tokens_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "calendar_tokens_token_unique" UNIQUE("token")
);

ALTER TABLE "calendar_tokens" ADD CONSTRAINT "calendar_tokens_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
```

### 4. Apply Locally

```bash
pnpm run db:migrate
```

### 5. Verify

```bash
pnpm run typecheck   # Schema types propagate correctly
pnpm test            # Existing tests still pass
pnpm run build       # No build errors
```

### 6. Commit Everything

Commit the schema change AND all `drizzle/` files together. The migration files are source-controlled and run in production on deploy.

## Common Migration Gotchas

### Drizzle `.default()` ≠ SQL `DEFAULT`

Drizzle's schema `.default()` does **not** always produce a `DEFAULT` clause in the migration SQL. If you add a NOT NULL column to a table with existing rows:

1. Check the generated SQL for `DEFAULT`
2. If missing, manually add it to the migration SQL
3. Or make the column nullable and set values in a data migration

See `.github/skills/schema-changes/SKILL.md` for the full checklist.

### Statement Breakpoints

Migration SQL files use `--> statement-breakpoint` comments to separate statements:

```sql
CREATE TABLE "calendar_tokens" ( ... );
--> statement-breakpoint
ALTER TABLE "calendar_tokens" ADD CONSTRAINT ...;
```

Drizzle's migrator splits on these. Don't remove them.

### Testing After Schema Changes

After any schema change, grep for ALL write and read sites:

```bash
grep -rn "insert(tableName)" app/ src/
grep -rn "update(tableName)" app/ src/
grep -rn "from(tableName)" app/ src/
grep -rn "innerJoin(tableName" app/ src/
```

Every insert must provide values for new NOT NULL columns. Every select/join may need the new column added to its field list.
