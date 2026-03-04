---
name: greenroom-dev-environment
description: "How to set up and run greenroom's development environment. USE FOR: starting dev server, running demos, Playwright testing, database setup, login credentials. Saves agents from fighting port conflicts, missing migrations, and auth issues."
---

# Greenroom Dev Environment

How to stand up My Call Time for local development, demos, and Playwright testing.

## Prerequisites

| Dependency | Check command | Notes |
|------------|--------------|-------|
| Node.js 20+ | `node -v` | Required |
| pnpm 9+ | `pnpm -v` | Required |
| Docker | `docker ps \| grep postgres` | For PostgreSQL |

## Quick Start

```bash
# 1. Install dependencies (skip if node_modules exists)
pnpm install

# 2. Ensure PostgreSQL is running
docker compose up -d

# 3. Run database migrations
pnpm run db:migrate

# 4. Start the dev server
pnpm dev
# Server runs at http://localhost:5173
```

## Database

- **Connection string** is in `.env` (see `.env.example` for the template)
- **Always run `pnpm run db:migrate`** before first use and after switching branches that include schema changes
- Migrations are idempotent — safe to re-run
- Use `pnpm run db:studio` to inspect the database via Drizzle Studio GUI

## Dev Server

The default command is `pnpm dev`, which starts Vite on port 5173.

### If port 5173 is taken

Check first:
```bash
lsof -i :5173
```

Start on a different port with IPv4 binding:
```bash
npx remix vite:dev --port 5174 --host 0.0.0.0
```

> **Important:** The `--host 0.0.0.0` flag is critical. Without it, Vite binds to IPv6 only (`::1`), and Playwright/curl on IPv4 (`127.0.0.1`) cannot connect. This causes confusing "connection refused" errors.

## Auth for Demos

### E2E test users

E2E test users are seeded with the password `TestPassword123!` (see `e2e/helpers/seed.ts`).

### If demo users have unknown passwords

Update the password hash directly in the database:

```bash
node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('TestPassword123!', 12);
console.log(hash);
"
# Then UPDATE users SET password_hash = '<hash>' WHERE email = 'demo@example.com';
```

### Login flow

The login page (`/login`) does **not** use CSRF tokens. Submit email + password via the form. Other forms throughout the app use `<CsrfInput />` — the CSRF token is generated in the root loader and stored in the session cookie.

## Playwright Demos

Use the `playwright-cli` skill for browser automation and demo recording.

### Checklist before recording

1. **Dev server is running** and accessible on IPv4 (`curl http://127.0.0.1:5173/api/health`)
2. **Database is migrated** (`pnpm run db:migrate`)
3. **Seed enough data** for a meaningful demo — create groups, availability requests, events, and member responses before recording
4. **Test users exist** with known passwords (see "Auth for Demos" above)

### Running Playwright tests

```bash
# Run all E2E tests
pnpm exec playwright test

# Run a specific test file
pnpm exec playwright test e2e/some-test.spec.ts

# Run in headed mode (see the browser)
pnpm exec playwright test --headed
```

## Common Pitfalls

### Port 5173 is already in use

Other Vite-based apps (or a previous dev session) may hold the port. Always check:
```bash
lsof -i :5173
```
Kill the process or use a different port (see "Dev Server" section above).

### Missing migrations → cryptic SQL errors

If you see errors like:
- `column "deleted_at" does not exist`
- `relation "event_assignments" does not exist`
- `column "webhook_url" of relation "groups" does not exist`

Run:
```bash
pnpm run db:migrate
```

This happens most often after switching branches that added new schema changes.

### CSRF token errors on form submission

- The login page does **not** use CSRF tokens
- All other POST forms require `<CsrfInput />` (a hidden field from `app/components/csrf-input.tsx`)
- The CSRF token is generated in the root loader and validated via `validateCsrfToken(request, formData)` in route actions
- If you get CSRF errors during testing, ensure you're loading the page first (to get the token) before submitting the form

### Dev server binds to IPv6 only

If `curl http://127.0.0.1:5173` fails but `curl http://[::1]:5173` works, the server is on IPv6 only. Restart with:
```bash
npx remix vite:dev --port 5173 --host 0.0.0.0
```

## Cleanup

- **Always clean up seeded test data after demos.** Don't leave test events, groups, or users in the database.
- If using a shared dev database, be mindful of test data that could confuse other developers.
- The E2E seed script in `e2e/helpers/seed.ts` creates isolated test data — prefer using it over manual seeding.
