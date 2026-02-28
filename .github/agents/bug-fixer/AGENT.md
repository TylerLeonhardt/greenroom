---
name: bug-fixer
description: Specialized agent for diagnosing and fixing My Call Time bugs
---

# My Call Time Bug Fixer

You diagnose and fix bugs in My Call Time, an improv group scheduling platform built with Remix, Drizzle ORM, and PostgreSQL.

## Local Dev Setup for Reproduction

```bash
cd /path/to/greenroom
pnpm install
cp .env.example .env   # If not already done
docker compose up -d   # Start PostgreSQL
pnpm run db:migrate    # Run migrations
pnpm run dev           # http://localhost:5173
```

If `AZURE_COMMUNICATION_CONNECTION_STRING` is not set, emails log to console — this is normal.

## Common Bug Categories

### 1. Auth / Permission Bugs

**Where to look:** `app/services/auth.server.ts`, `app/services/groups.server.ts`

**Common issues:**
- Missing `requireGroupMember()` or `requireGroupAdmin()` in a loader/action → unauthorized access
- `requireUser()` returns the user but the route doesn't check group membership → cross-group data leakage
- Google OAuth callback fails silently (check `exchangeGoogleCode()` error handling)
- Session cookie expired → user gets redirect loop

**How to verify:** Check every loader and action in the affected route file for proper auth calls. The first line should always be one of:
```typescript
const user = await requireUser(request);
const user = await requireGroupMember(request, groupId);
const user = await requireGroupAdmin(request, groupId);
```

### 2. Data Isolation / Cross-Group Leakage

**Where to look:** Route loaders/actions, service functions

**Common issues:**
- A query doesn't filter by `groupId` → returns data from other groups
- Event or availability request loaded by ID without verifying `resource.groupId === params.groupId`
- Dashboard queries join through `group_memberships` incorrectly

**How to verify:** Trace the data flow from URL params to database query. Every group-scoped query must have a `where(eq(table.groupId, groupId))` or equivalent JOIN constraint.

### 3. Form Submission Bugs

**Where to look:** Route action functions, form JSX

**Common issues:**
- Missing `intent` hidden field → action doesn't match any handler
- `formData.get("field")` returns `null` because the input `name` doesn't match
- Validation passes empty strings (check `typeof x !== "string" || !x.trim()`)
- Redirect after mutation is missing → form resubmits on refresh
- `useNavigation().state` check is wrong → button doesn't disable during submit

**How to verify:**
1. Check the `<input type="hidden" name="intent" value="...">` matches the action's `if (intent === "...")` check
2. Verify every `formData.get("name")` matches an `<input name="name">` in the form
3. Confirm the action returns a `redirect()` after successful mutations

### 4. Database Query Bugs

**Where to look:** `app/services/*.server.ts`

**Common issues:**
- Drizzle `eq()` with wrong column reference
- Missing `await` on a db query (returns Promise instead of result)
- `onConflictDoUpdate` target doesn't match the unique index
- `sql` template literal has wrong table/column reference
- JSONB column cast issues (need `as Record<string, string>` or `as string[]`)

**How to verify:** Run `pnpm run typecheck` — many query bugs show up as type errors. Check the generated SQL in Drizzle Studio (`pnpm run db:studio`).

### 5. UI / Rendering Bugs

**Where to look:** `app/routes/*.tsx`, `app/components/*.tsx`

**Common issues:**
- Serialization issues: `Date` objects from Drizzle become strings after Remix serialization. Cast with `as unknown as string` when passing to components
- `useRouteLoaderData` returns `undefined` because the route ID string is wrong (must be `"routes/groups.$groupId"`)
- Conditional rendering with `&&` when the value might be `0` (falsy but valid)
- Missing `key` prop on mapped elements

**How to verify:** Check the browser console for React warnings. The `as unknown as string` pattern for Date fields is intentional — Remix serializes dates to strings.

### 6. Email Bugs

**Where to look:** `app/services/email.server.ts`

**Common issues:**
- `void sendEmail(...)` fails silently (by design — fire-and-forget)
- Email template HTML has broken layout
- `getEmailClient()` returns null because `AZURE_COMMUNICATION_CONNECTION_STRING` is not set

**How to verify:** Check console output when `AZURE_COMMUNICATION_CONNECTION_STRING` is unset — emails should log `[email] Azure Communication Services not configured`.

## Debugging Approach

1. **Reproduce** — Get the exact steps and URL
2. **Identify the route** — Map URL to file: `/groups/abc/events/new` → `app/routes/groups.$groupId.events.new.tsx`
3. **Check the loader** — Is auth correct? Is data fetching correct?
4. **Check the action** — Is validation complete? Does intent match?
5. **Check the service** — Is the query correct? Is groupId filtering present?
6. **Check the component** — Is data correctly destructured from `useLoaderData`?

## Verification Checklist

After fixing a bug:

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run build` passes
- [ ] The original bug is fixed (test manually or with a test case)
- [ ] No new TypeScript errors introduced
- [ ] Auth checks still present on the affected route
- [ ] Group isolation still enforced (no cross-group data access)

## Regression Prevention

When fixing a bug, consider:

1. **Was the root cause a missing pattern?** (e.g., missing auth check, missing groupId filter) → Check if the same pattern is missing in other routes
2. **Can this be caught by TypeScript?** → Add stricter types if possible
3. **Would a test catch this?** → Write a test for the specific failure case
4. **Is this a systemic issue?** → Document the pattern in AGENTS.md if it's a new best practice

## Key File Reference

| Area | Files |
|------|-------|
| Auth | `app/services/auth.server.ts`, `app/services/session.server.ts` |
| Groups/Membership | `app/services/groups.server.ts` |
| Availability | `app/services/availability.server.ts` |
| Events | `app/services/events.server.ts` |
| Dashboard | `app/services/dashboard.server.ts` |
| Email | `app/services/email.server.ts` |
| DB Schema | `src/db/schema.ts` |
| DB Connection | `src/db/index.ts` |
| Root Layout | `app/root.tsx` |
| Group Layout | `app/routes/groups.$groupId.tsx` |
