---
name: drizzle-migrations
description: Drizzle ORM migration workflow, snapshot chain management, and schema conventions for the My Call Time codebase
---

# Drizzle Migration Internals

This skill covers the migration toolchain, file structure, and snapshot chain mechanics. For schema conventions and table patterns, see the `greenroom-db` skill. For the full schema change safety checklist, see the `schema-changes` skill.

## Drizzle Config

```typescript
// drizzle.config.ts
export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: { url: process.env.DATABASE_URL },
});
```

- `out` — output directory for generated SQL and snapshots
- `schema` — single source of truth for all tables, enums, and indexes
- `dialect` — PostgreSQL-specific generation

## Production Migrations (`scripts/migrate.mjs`)

Migrations auto-run on container startup:

```javascript
import { migrate } from "drizzle-orm/node-postgres/migrator";
await migrate(db, { migrationsFolder: "./drizzle" });
```

- **Idempotent** — safe with multiple replicas (Drizzle tracks applied migrations in a `__drizzle_migrations` table)
- **Fails fast** on error — prevents app from starting with a broken schema
- Uses the same `pg.Pool` config as the app (SSL in production with DigiCert CA cert)

## The `drizzle/` Directory

```
drizzle/
├── 0000_wise_hammerhead.sql      # Migration SQL files (auto-named)
├── 0001_narrow_liz_osborn.sql
├── ...
├── 0015_sticky_leper_queen.sql   # Latest migration
└── meta/
    ├── _journal.json             # Migration journal (ordered list)
    ├── 0000_snapshot.json        # Schema snapshot per migration
    ├── ...
    └── 0015_snapshot.json
```

### Journal (`_journal.json`)

Ordered array of migration entries:

```json
{
  "idx": 15,
  "version": "7",
  "when": 1777905664500,
  "tag": "0015_sticky_leper_queen",
  "breakpoints": true
}
```

- `idx` — sequential integer (0, 1, 2, ...)
- `tag` — matches the `.sql` filename (without extension)
- `when` — Unix timestamp of generation
- `breakpoints` — whether the SQL uses statement breakpoints (always `true`)

### Snapshot Chain

Each snapshot captures the full schema state after that migration. Snapshots form a **linked chain** via `prevId` → `id`:

```
0012_snapshot.json: { "id": "4957071d-...", "prevId": "8b50307a-..." }
0013_snapshot.json: { "id": "02f0375f-...", "prevId": "4957071d-..." }
```

`prevId` of snapshot N **must** equal `id` of snapshot N-1. Drizzle diffs the previous snapshot against the current schema to generate migration SQL. If this chain breaks, `db:generate` produces incorrect or empty migrations.

### The Snapshot ID Collision Problem

When multiple branches create migrations concurrently (both branch off the same base and add migration `0012`), they produce snapshots with **different content but the same index**. After merging:

- The journal may have duplicate `idx` values
- The snapshot chain `prevId → id` breaks
- `pnpm run db:generate` silently produces wrong diffs or no-op migrations

**How to detect** (after merging branches that both touched `drizzle/`):
1. `_journal.json` has no duplicate `idx` values
2. Each snapshot's `prevId` matches the previous snapshot's `id`
3. Run `pnpm run db:generate` — if it generates a migration on a clean schema, the chain is broken

**How to fix:**
1. Re-number the colliding migration (rename SQL file and update journal entry)
2. Regenerate the snapshot for the re-numbered migration by running `pnpm run db:generate` from a clean state
3. Verify the chain is intact

**Prevention:** Coordinate with other developers when multiple branches need schema changes. Ideally only one in-flight branch adds migrations at a time.

## Statement Breakpoints

Migration SQL files use `--> statement-breakpoint` comments to separate statements:

```sql
CREATE TABLE "calendar_tokens" ( ... );
--> statement-breakpoint
ALTER TABLE "calendar_tokens" ADD CONSTRAINT ...;
```

Drizzle's migrator splits the file on these markers and executes each statement independently. **Do not remove them** — without breakpoints, multi-statement migrations will fail because PostgreSQL cannot run certain DDL combinations in a single statement.
