---
name: codebase-conventions
description: GreenRoom (My Call Time) project stack, coding conventions, route patterns, service layer, testing approach, and quality gates
---

# GreenRoom Codebase Conventions

Start here for a quick orientation. Detailed patterns live in the specialized skills listed at the bottom.

## Project Stack

| Layer | Technology |
|-------|-----------|
| Framework | Remix v2 (React) with Vite bundler |
| Database | PostgreSQL via Drizzle ORM |
| Styling | TailwindCSS v4 (utility classes, emerald/slate palette) |
| Icons | `lucide-react` exclusively |
| Components | shadcn/ui patterns (Radix primitives, `cn()` from `src/lib/utils.ts`) |
| Unit Tests | Vitest |
| E2E Tests | Playwright |
| Linter/Formatter | Biome (tabs, double quotes, semicolons, 100 char line width) |
| Runtime | Node.js 20+ |
| Package Manager | pnpm 9+ |
| Deployment | Docker → Azure Container Apps |

## Quality Gates

Run these before every commit. CI enforces them on every push/PR to `master`:

```bash
pnpm run typecheck   # tsc --noEmit (strict mode)
pnpm run lint        # biome check . (lint + format check)
pnpm test            # vitest run (unit tests)
pnpm run build       # remix vite:build (production build)
```

**CI has three parallel jobs:**
1. **check** — typecheck → lint → build → vitest
2. **playwright-explorer** — Component explorer Playwright tests (no DB needed)
3. **playwright-e2e** — App E2E tests with PostgreSQL service container

## File Structure

```
app/
├── routes/          # Remix file-based routes
├── services/        # Server-side business logic (*.server.ts)
├── components/      # Reusable React components
├── lib/             # Shared utility functions
├── root.tsx         # Root layout
└── tailwind.css     # TailwindCSS v4 entry

src/
├── db/
│   ├── schema.ts    # Drizzle ORM schema (single file, all tables)
│   └── index.ts     # Database connection
└── lib/
    └── utils.ts     # cn() utility (clsx + tailwind-merge)
```

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Routes | Flat dot notation | `groups.$groupId.events.new.tsx` |
| Services | `*.server.ts` suffix | `app/services/events.server.ts` |
| Components | kebab-case | `app/components/event-card.tsx` |
| Tests | Co-located `.test.ts(x)` | `app/services/groups.server.test.ts` |
| Utilities | In `app/lib/` | `app/lib/date-utils.ts` |

The `.server.ts` suffix is required for service files — Remix uses it to strip server-only code from the client bundle.

## Shared Utilities (`app/lib/`)

| File | Purpose |
|------|---------|
| `date-utils.ts` | Centralized date/time formatting (all `Intl.DateTimeFormat`). Single source of truth — never use inline `toLocaleDateString()`. All functions accept optional `timezone?: string`. |
| `ical-utils.ts` | RFC 5545 iCalendar format helpers (date formatting, text escaping, line folding, feed generation) |
| `edit-utils.ts` | Diff/change detection and human-readable summaries for event and availability request edits |

```typescript
// Always use date-utils for formatting:
import { formatDate, formatTime, formatDateTime } from "~/lib/date-utils";

// Pass user's timezone for server-side rendering:
formatDate(event.startTime, user.timezone);
```

## UI Component Patterns

- **`<CsrfInput />`** — Include in every state-changing `<Form>`. Renders a hidden CSRF token field.
- **`<DangerZone>`** — Wrapper for destructive actions (delete group, delete account). Compound component: `<DangerZone.Title>`, `<DangerZone.Description>`, then a `<Form>` inside. For high-stakes deletions, require typing a confirmation string before enabling submit.
- **Confirmation dialogs** — For less severe destructive actions, use `onClick` with `confirm()` and `e.preventDefault()` on cancel.
- **Submit buttons** — Disable during submission using `useNavigation().state`.

## Logging

Structured logging via pino. Import from `app/services/logger.server.ts`:

```typescript
import { logger } from "./logger.server.js";

logger.info({ userId, groupId }, "User joined group");
logger.error({ err: error, to: recipients }, "Failed to send email");
```

- Structured context as first argument, message as second
- `LOG_LEVEL` env var controls verbosity (default: `"info"`)
- Production: plain JSON to stdout (for log aggregation)

## Telemetry

Optional Azure Application Insights integration. Graceful no-op if not configured:

```typescript
import { getTelemetryClient } from "~/services/telemetry.server";

getTelemetryClient()?.trackEvent({ name: "EventCreated", properties: { groupId } });
getTelemetryClient()?.trackException({ exception: error });
```

## Session Cookie

- Name: `__greenroom_session`
- httpOnly, sameSite lax, secure in production
- 30-day expiry
- Signed with `SESSION_SECRET` env var

## Adding a New Feature — Checklist

1. **Schema** — Add tables/columns in `src/db/schema.ts`
2. **Migration** — `pnpm run db:generate` → review SQL → `pnpm run db:migrate`
3. **Service** — Create `app/services/{feature}.server.ts` with query functions
4. **Route** — Add `app/routes/{path}.tsx` with loader/action + component
5. **Components** — Extract reusable UI to `app/components/`
6. **Auth** — Use appropriate guard (`requireUser`, `requireGroupMember`, `requireGroupAdmin`, or `requireGroupAdminOrPermission`)
7. **Tests** — Co-located test file, mock services, test loaders/actions directly
8. **Quality Gates** — `pnpm run typecheck && pnpm run lint && pnpm test && pnpm run build`

## Specialized Skills

For deeper guidance, see these skills:

| Skill | What It Covers |
|-------|---------------|
| `greenroom-architecture` | Remix route structure, loader/action patterns, service layer conventions, intent-based actions, component architecture, UI styling |
| `greenroom-db` | Drizzle ORM schema reference, table definitions, query patterns (joins, upserts, transactions), JSON columns, indexes, multi-tenancy |
| `drizzle-migrations` | Migration toolchain internals: snapshot chain, `_journal.json`, `drizzle.config.ts`, `scripts/migrate.mjs`, statement breakpoints |
| `schema-changes` | Pre-commit checklist for schema changes: finding write sites, NOT NULL pitfalls, migration defaults, FK cascades, LEFT JOIN awareness |
| `greenroom-testing` | Vitest configuration, testing loaders/actions, mocking services and auth, test file structure, rate limiting tests, environment setup |
| `greenroom-security` | Auth guard hierarchy, multi-tenancy isolation, rate limiting, CSRF protection, session security, password hashing, OAuth CSRF, invite codes |
| `ical-feeds` | iCalendar (RFC 5545) feed generation, token-based auth for non-browser clients, subscribable calendar feeds |
