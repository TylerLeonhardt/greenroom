# Schema Changes Checklist

Read this **before** adding or modifying any database column, table, or constraint.

> **Why this exists:** A NOT NULL column was added to `group_memberships` but two insert sites (`createGroup`, `joinGroup`) weren't updated. Drizzle's `.default()` didn't propagate to the DB migration, breaking group creation in production.

## Before Writing Any Code

- [ ] **Find ALL write sites.** Grep for every `insert(tableName)` and `update(tableName)` call across the codebase. Every single one must be reviewed and updated.
  ```bash
  # Example: changing the group_memberships table
  grep -rn "insert(groupMemberships)" app/ src/
  grep -rn "update(groupMemberships)" app/ src/
  ```
- [ ] **Check read sites too.** Grep for `select()` queries on the table — new columns may need to appear in responses, forms, or API output.

## Adding a NOT NULL Column

- [ ] **Always provide explicit values in every insert.** Drizzle ORM `.default()` in the schema does **not** reliably propagate to the generated SQL migration. Never rely on the schema default alone — pass the value explicitly in every `insert()` call.
- [ ] **Migration must include `DEFAULT` for existing rows.** The generated migration SQL must have a `DEFAULT` clause so existing rows don't violate the NOT NULL constraint. Check the generated SQL in `drizzle/` — if Drizzle didn't add it, edit the migration manually before running it.
- [ ] **Consider making it nullable first.** If the column is optional in practice, use `.default()` + nullable instead of NOT NULL. Safer for rollbacks.

## After Schema Changes

- [ ] **Run `pnpm run db:generate`.** Always generate the migration file and review the SQL it produces. Commit the migration with your schema change.
- [ ] **Run `pnpm run db:migrate`.** Apply locally and verify no errors.
- [ ] **Test the full lifecycle manually.** Create, read, update, delete for the affected entity. The test suite alone isn't enough — new columns can break flows that have no test coverage.
- [ ] **Run the quality gates.** `pnpm run typecheck && pnpm run lint && pnpm run build && pnpm test`

## Foreign Keys & Relationships

- [ ] **Check cascade impacts.** If changing foreign keys or adding `ON DELETE` behavior, trace all FK relationships and verify existing delete/cleanup code still works.
- [ ] **LEFT JOIN awareness.** If making a FK nullable (e.g., for soft delete), find all `innerJoin` calls on that FK and convert to `leftJoin` with fallback display values. Grep:
  ```bash
  grep -rn "innerJoin(tableName" app/ src/
  ```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Added `.default()` in schema, assumed DB has it | Check the migration SQL — add `DEFAULT` explicitly if missing |
| Updated one insert site, missed others | Grep for ALL `insert(table)` calls before committing |
| NOT NULL column with no migration default | Existing rows break — always include `DEFAULT` in migration |
| Changed FK constraint, didn't check joins | Grep for all joins on that table and verify query correctness |
| Forgot to commit migration file | `pnpm run db:generate` and commit the `drizzle/` output |
