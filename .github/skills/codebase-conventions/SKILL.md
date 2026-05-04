---
name: codebase-conventions
description: GreenRoom (My Call Time) project stack, coding conventions, route patterns, service layer, testing approach, and quality gates
---

# GreenRoom Codebase Conventions

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

## Route Patterns

### File-Based Routing

Remix v2 flat file routing maps dots to path segments:

```
groups.$groupId.events.new.tsx  →  /groups/:groupId/events/new
groups.$groupId.tsx             →  Layout route (renders <Outlet />)
groups.$groupId._index.tsx      →  Index route for the layout
settings_.delete-account.tsx    →  /settings/delete-account (escaped from settings layout)
```

### Loader/Action Pattern

Every route that reads data has a `loader`. Every route that writes data has an `action`:

```typescript
export async function loader({ request, params }: LoaderFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupMember(request, groupId);
	const data = await getGroupEvents(groupId);
	return { events: data, userId: user.id };
}

export async function action({ request, params }: ActionFunctionArgs) {
	const groupId = params.groupId ?? "";
	const user = await requireGroupAdmin(request, groupId);
	const formData = await request.formData();
	const intent = formData.get("intent");
	// ... handle based on intent
}
```

### Intent-Based Multi-Action Routes

When a route has multiple form actions, use a hidden `intent` field:

```typescript
// In the action:
if (intent === "close") { /* ... */ }
if (intent === "reopen") { /* ... */ }
if (intent === "respond") { /* ... */ }

// In the component:
<Form method="post">
	<input type="hidden" name="intent" value="close" />
	<button type="submit">Close</button>
</Form>
```

### Resource Routes (API Endpoints)

Routes that return non-HTML responses (JSON, iCal, etc.) are **resource routes** — they export a `loader` and/or `action` but no `default` component:

```typescript
// app/routes/api.health.tsx — JSON health check
export async function loader() {
	return Response.json({ status: "ok", timestamp: new Date().toISOString() });
}

// app/routes/api.calendar.$token.ics.tsx — iCal feed
export async function loader({ params }: LoaderFunctionArgs) {
	// ... return new Response(icsContent, { headers: { "Content-Type": "text/calendar" } })
}
```

### Accessing Parent Layout Data

Child routes can access parent layout loader data:

```typescript
const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
const role = parentData?.role;
```

## Authentication

### Auth Guards

Four levels of protection, used in every loader/action:

```typescript
// Any authenticated user — redirects to /login
const user = await requireUser(request);

// Must be a member of the group — throws 404
const user = await requireGroupMember(request, groupId);

// Must be an admin — throws 403
const user = await requireGroupAdmin(request, groupId);

// Admin OR member with a specific permission — throws 403
const user = await requireGroupAdminOrPermission(request, groupId, "membersCanCreateRequests");
```

- `getOptionalUser(request)` returns `AuthUser | null` (used in root loader for nav)
- Auth uses `remix-auth` with `FormStrategy` for email/password
- Google OAuth is a manual implementation (not using remix-auth adapter)
- Session cookie: `__greenroom_session`, httpOnly, sameSite lax, secure in production, 30-day expiry
- **No "logged in but unverified" state** — signup doesn't create a session; users must verify email first

### Soft-Delete User Handling

Deleted users have `deletedAt` set. Auth guards and token lookups reject them:

```typescript
if (!row || row.deletedAt) return null;
```

Account deletion has a 30-day reactivation window — logging in within 30 days clears `deletedAt`.

## Service Layer

### Pattern

Services live in `app/services/*.server.ts`. They export functions that encapsulate business logic and database queries:

```typescript
// app/services/events.server.ts
export async function createEvent(data: CreateEventInput): Promise<Event> {
	const [event] = await db.insert(events).values({ ... }).returning();
	getTelemetryClient()?.trackEvent({ name: "EventCreated", properties: { ... } });
	return event;
}
```

Conventions:
- Import `db` from `../../src/db/index.js` and schema tables from `../../src/db/schema.js`
- Return typed objects or DB rows
- Trim user input before writing
- Track custom events via `getTelemetryClient()?.trackEvent()`
- Auth guards (`requireUser`, `requireGroupMember`, etc.) live in `app/services/groups.server.ts`
- Throw `Response` objects for HTTP errors (404, 403), `Error` for unexpected failures

### Fire-and-Forget Pattern

Email notifications and webhooks use fire-and-forget — don't block the user's request:

```typescript
// void prefix, no await — fire and forget
void sendAvailabilityRequestNotification({ ... });
```

Email service gracefully degrades: if `AZURE_COMMUNICATION_CONNECTION_STRING` is not set, it logs instead of throwing.

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

## Testing Approach

### Unit Tests (Vitest)

Test files are co-located with their source: `foo.server.ts` → `foo.server.test.ts`.

#### Mocking Services

Mock dependencies with `vi.mock()` **before** importing the module under test:

```typescript
vi.mock("~/services/calendar-token.server", () => ({
	getUserByCalendarToken: vi.fn(),
}));
vi.mock("~/services/events.server", () => ({
	getUserCalendarEvents: vi.fn(),
}));
vi.mock("~/services/logger.server", () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("../../src/db/index.js", () => ({ db: {} }));

// Then import:
import { loader } from "./api.calendar.$token.ics";
```

#### Testing Route Loaders/Actions

Construct `Request` objects and call loaders/actions directly:

```typescript
const response = await loader({
	request: new Request("http://localhost/api/calendar/validtoken.ics"),
	params: { token: "validtoken" },
	context: {},
});

expect(response.status).toBe(200);
const body = await response.text();
expect(body).toContain("BEGIN:VCALENDAR");
```

For actions, use `FormData`:

```typescript
const formData = new FormData();
formData.set("intent", "close");
const response = await action({
	request: new Request("http://localhost/route", { method: "POST", body: formData }),
	params: { groupId: "group-1" },
	context: {},
});
```

#### Component Tests

Use jsdom environment + Testing Library + `userEvent`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
```

#### Test Lifecycle

```typescript
beforeEach(() => {
	vi.clearAllMocks();
});
```

### Rate Limiting in Tests

The rate limiter uses in-memory state. Reset it between tests:

```typescript
import { _resetForTests } from "~/services/rate-limit.server";
beforeEach(() => _resetForTests());
```

## UI Patterns

### Forms

Standard Remix `<Form>` with intent-based actions:

```tsx
<Form method="post">
	<CsrfInput />
	<input type="hidden" name="intent" value="update-name" />
	<input name="name" defaultValue={group.name} />
	<button type="submit" disabled={isSubmitting}>Save</button>
</Form>
```

- Always include `<CsrfInput />` for state-changing forms
- Disable submit buttons during submission using `useNavigation().state`

### Danger Zone

Use the `DangerZone` component for destructive actions (delete group, delete account):

```tsx
<DangerZone>
	<DangerZone.Title>Delete Group</DangerZone.Title>
	<DangerZone.Description>This action cannot be undone.</DangerZone.Description>
	<Form method="post">
		<input type="hidden" name="intent" value="delete" />
		<button type="submit">Delete</button>
	</Form>
</DangerZone>
```

For high-stakes deletions, require the user to type a confirmation string (e.g., their email address) before the submit button is enabled.

### Confirmation Dialogs

For destructive actions that are less severe than full deletion, use `onClick` confirmation:

```tsx
<button
	type="submit"
	onClick={(e) => {
		if (!confirm("Are you sure you want to regenerate your calendar feed URL?")) {
			e.preventDefault();
		}
	}}
>
	Regenerate
</button>
```

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

## Adding a New Feature — Checklist

1. **Schema** — Add tables/columns in `src/db/schema.ts`
2. **Migration** — `pnpm run db:generate` → review SQL → `pnpm run db:migrate`
3. **Service** — Create `app/services/{feature}.server.ts` with query functions
4. **Route** — Add `app/routes/{path}.tsx` with loader/action + component
5. **Components** — Extract reusable UI to `app/components/`
6. **Auth** — Use appropriate guard (`requireUser`, `requireGroupMember`, `requireGroupAdmin`, or `requireGroupAdminOrPermission`)
7. **Tests** — Co-located test file, mock services, test loaders/actions directly
8. **Quality Gates** — `pnpm run typecheck && pnpm run lint && pnpm test && pnpm run build`
