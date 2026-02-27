# GreenRoom — Agent Notes

Institutional knowledge for agents working on the GreenRoom codebase. Read this before touching anything.

## What Is GreenRoom?

GreenRoom is a scheduling platform for improv groups. It solves the "when is everyone free?" problem that every improv troupe, ensemble, or comedy team faces. An admin creates an availability request, members respond with Available/Maybe/Unavailable per date, and the admin sees a heatmap of the best dates to schedule rehearsals or shows.

**Who it's for:** Improv group organizers (admins) and their members. Multi-group support — one user can be in many groups.

**Core workflow:**
1. Admin creates a group, shares an 8-character invite code
2. Members join via invite code
3. Admin creates an availability request with a date range
4. Members submit their availability (available/maybe/not_available per date)
5. Admin views aggregated results as a heatmap with scores (available×2 + maybe×1)
6. Admin creates events from the best dates, optionally auto-assigning available members
7. Assigned members confirm/decline attendance

## Architecture Overview

Remix v2 full-stack app with Vite, deployed as a Docker container on Azure Container Apps.

```
app/
├── root.tsx                    # Root layout: nav bar, loading bar, error boundary
├── tailwind.css                # TailwindCSS v4 entry (just @import "tailwindcss")
├── routes/                     # Remix file-based routes (flat convention)
│   ├── _index.tsx              # Landing page (public)
│   ├── login.tsx               # Email/password + Google OAuth login
│   ├── signup.tsx              # Registration with password strength meter
│   ├── logout.tsx              # POST-only logout action
│   ├── auth.google.tsx         # Redirects to Google OAuth consent
│   ├── auth.google.callback.tsx # Handles Google OAuth code exchange
│   ├── api.health.tsx          # Health check endpoint (GET)
│   ├── $.tsx                   # Catch-all 404 page
│   ├── dashboard.tsx           # Authenticated dashboard (requires login)
│   ├── groups.tsx              # Groups list with inline join form
│   ├── groups.new.tsx          # Create group form
│   ├── groups.join.tsx         # Join group via invite code (supports ?code= param)
│   ├── groups.$groupId.tsx     # Group layout with tab navigation (Outlet)
│   ├── groups.$groupId._index.tsx        # Group overview: members, stats, upcoming events
│   ├── groups.$groupId.availability.tsx  # Availability request list
│   ├── groups.$groupId.availability.new.tsx     # Create availability request (admin)
│   ├── groups.$groupId.availability.$requestId.tsx  # View/respond to request + results heatmap
│   ├── groups.$groupId.events.tsx        # Event list + calendar view
│   ├── groups.$groupId.events.new.tsx    # Create event (admin, supports ?fromRequest=)
│   ├── groups.$groupId.events.$eventId.tsx      # Event detail: cast list, confirm/decline
│   ├── groups.$groupId.events.$eventId.edit.tsx # Edit/delete event (admin)
│   └── groups.$groupId.settings.tsx      # Group settings: edit name, regenerate invite code
├── services/                   # Server-side business logic (*.server.ts)
│   ├── auth.server.ts          # Authentication: form strategy, Google OAuth, requireUser()
│   ├── session.server.ts       # Cookie session storage, getUserId(), createUserSession()
│   ├── groups.server.ts        # Group CRUD, membership, invite codes, requireGroupMember/Admin
│   ├── availability.server.ts  # Availability requests, responses, aggregation
│   ├── events.server.ts        # Events CRUD, assignments, bulk assign, cross-group queries
│   ├── dashboard.server.ts     # Dashboard data aggregation (parallel queries)
│   ├── email.server.ts         # Azure Communication Services email with graceful fallback
│   ├── logger.server.ts        # Pino structured logger, configurable via LOG_LEVEL env var
│   └── rate-limit.server.ts    # In-memory sliding window rate limiter for auth routes
└── components/                 # Reusable React components
    ├── availability-grid.tsx   # Date × status grid for submitting availability
    ├── date-selector.tsx       # Calendar-based date picker for creating requests
    ├── event-calendar.tsx      # Monthly calendar view with event dots
    ├── event-card.tsx          # Reusable event card (used in dashboard, lists, sidebar)
    └── results-heatmap.tsx     # Aggregated availability results with scoring

src/
├── db/
│   ├── schema.ts               # Drizzle ORM schema (all tables, enums, indexes)
│   └── index.ts                # Database connection (pg Pool + drizzle)
└── lib/
    └── utils.ts                # cn() utility (clsx + tailwind-merge)
```

## Key Patterns

### Authentication

Three levels of auth protection used in route loaders/actions:

```typescript
// Any authenticated user — redirects to /login if not signed in
const user = await requireUser(request);

// Must be a member of the specific group — throws 404 if not
const user = await requireGroupMember(request, groupId);

// Must be an admin of the specific group — throws 403 if not admin
const user = await requireGroupAdmin(request, groupId);
```

- `getOptionalUser(request)` returns `AuthUser | null` (used in root loader for nav)
- Auth uses `remix-auth` with `FormStrategy` for email/password
- Google OAuth is manual implementation (not using remix-auth-google adapter) — see `getGoogleAuthURL()`, `exchangeGoogleCode()`, `findOrCreateGoogleUser()`
- Session is a signed cookie (`__greenroom_session`, 30 day expiry)

### Data Flow

```
Route loader/action
  → requireUser/requireGroupMember/requireGroupAdmin (auth check)
  → Service function (app/services/*.server.ts)
  → Drizzle query (using db from src/db/index.ts)
  → PostgreSQL
```

Every route that touches group data MUST validate group membership. The pattern is always:
1. Extract `groupId` from `params`
2. Call `requireGroupMember()` or `requireGroupAdmin()`
3. Then call service functions with the validated groupId

### Multi-Tenancy

**App-layer enforcement, not RLS.** Every query that touches group data filters by `groupId`. There is no PostgreSQL Row-Level Security — isolation is enforced by:
- `requireGroupMember()`/`requireGroupAdmin()` in every loader/action
- Service functions accepting `groupId` as a parameter and filtering with `eq(table.groupId, groupId)`

**Cross-group data leakage prevention:** When loading event details, the loader checks `data.event.groupId !== groupId` and throws 404. Same for availability requests. Never trust a URL parameter alone — always verify the resource belongs to the group.

### Email

Fire-and-forget pattern with graceful degradation:

```typescript
// In route action — fire and forget (void prefix, no await)
void sendAvailabilityRequestNotification({ ... });
```

- If `AZURE_COMMUNICATION_CONNECTION_STRING` is not set, emails log to console instead of throwing
- `sendEmail()` returns `{ success: boolean; error?: string }` — never throws
- Email sending never blocks the user's request/response cycle

### Logging

Structured logging via [pino](https://getpino.io/). Import the singleton logger from `app/services/logger.server.ts`:

```typescript
import { logger } from "./logger.server.js";

logger.info({ userId, groupId }, "User joined group");
logger.warn({ key, maxRequests }, "Rate limit exceeded");
logger.error({ err: error, to: recipients }, "Failed to send email");
```

- Log level controlled by `LOG_LEVEL` env var (default: `"info"`)
- In development, logs are plain JSON to stdout
- In production, logs are JSON (no pretty-printing transport) for log aggregation
- Always pass structured context as the first argument, message as the second

### Rate Limiting

In-memory sliding window rate limiter in `app/services/rate-limit.server.ts`. Used on auth routes to prevent brute-force attacks:

```typescript
import { checkLoginRateLimit, checkSignupRateLimit } from "~/services/rate-limit.server";

// In a route action:
const rateLimit = checkLoginRateLimit(request);
if (rateLimit.limited) {
  return json(
    { error: `Too many attempts. Try again in ${rateLimit.retryAfter} seconds.` },
    { status: 429 }
  );
}
```

- `checkLoginRateLimit(request)` — 10 requests per minute per IP
- `checkSignupRateLimit(request)` — 5 requests per minute per IP
- `checkRateLimit(key, maxRequests, windowMs)` — generic function for custom limits
- `_resetForTests()` — clears all rate limit state (use in test `beforeEach`)
- Stale entries cleaned up every 5 minutes automatically
- IP extracted from `x-forwarded-for` header (works behind Azure Container Apps proxy)

### Remix Route Conventions

- Flat file routing: `groups.$groupId.events.new.tsx` → `/groups/:groupId/events/new`
- `groups.$groupId.tsx` is a layout route with `<Outlet />` and tab navigation
- Actions use `intent` form field to distinguish between multiple actions in one route
- `useRouteLoaderData("routes/groups.$groupId")` accesses parent layout data from child routes

### Form Pattern (Intent-Based Actions)

```typescript
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "close") { /* ... */ }
  if (intent === "reopen") { /* ... */ }
  if (intent === "respond") { /* ... */ }
}
```

## Route Map

| Route | Auth | Description |
|-------|------|-------------|
| `/` | Public | Landing page (redirects to `/dashboard` if logged in) |
| `/login` | Public | Login form (email/password + Google OAuth) |
| `/signup` | Public | Registration form with password strength meter |
| `/logout` | POST only | Destroys session, redirects to `/` |
| `/auth/google` | Public | Redirects to Google OAuth consent screen |
| `/auth/google/callback` | Public | Handles OAuth code exchange, creates session |
| `/api/health` | Public | Returns `{ status: "ok", timestamp }` |
| `/dashboard` | `requireUser` | Action items, upcoming events, group list |
| `/groups` | `requireUser` | List user's groups + inline join form |
| `/groups/new` | `requireUser` | Create group form |
| `/groups/join` | `requireUser` | Join via invite code (supports `?code=` query param) |
| `/groups/:groupId` | `requireGroupMember` | Layout with tabs: Overview, Availability, Events, Settings |
| `/groups/:groupId` (index) | `requireGroupMember` | Member list, quick stats, upcoming events sidebar |
| `/groups/:groupId/availability` | `requireGroupMember` | List availability requests with progress bars |
| `/groups/:groupId/availability/new` | `requireGroupAdmin` | Create availability request with date picker |
| `/groups/:groupId/availability/:requestId` | `requireGroupMember` | Submit response + admin results heatmap |
| `/groups/:groupId/events` | `requireGroupMember` | Event list (list/calendar toggle) with type filter |
| `/groups/:groupId/events/new` | `requireGroupAdmin` | Create event (supports `?fromRequest=&date=`) |
| `/groups/:groupId/events/:eventId` | `requireGroupMember` | Event detail, cast list, confirm/decline |
| `/groups/:groupId/events/:eventId/edit` | `requireGroupAdmin` | Edit/delete event |
| `/groups/:groupId/settings` | `requireGroupAdmin` | Edit group name/description, regenerate invite code |

## Database Schema

6 tables + 5 enums. All PKs are UUIDs (`defaultRandom()`). All timestamps are `with time zone`.

### Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, email (unique), passwordHash, name, googleId (unique), emailVerified | Supports email/password + Google OAuth. `passwordHash` is null for Google-only users |
| `groups` | id, name, inviteCode (unique, 8 chars), createdById → users | Invite code uses chars `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous I/O/0/1) |
| `group_memberships` | id, groupId → groups, userId → users, role (admin/member) | Unique on (groupId, userId). Creator gets admin role |
| `availability_requests` | id, groupId → groups, title, requestedDates (JSONB `string[]`), status (open/closed), expiresAt | `requestedDates` is a JSON array of ISO date strings |
| `availability_responses` | id, requestId → availability_requests, userId → users, responses (JSONB) | `responses` is `Record<string, "available" | "maybe" | "not_available">`. Upsert on (requestId, userId) |
| `events` | id, groupId → groups, title, eventType, startTime, endTime, location, createdFromRequestId | Links back to availability request if created from one |
| `event_assignments` | id, eventId → events, userId → users, role, status (pending/confirmed/declined) | Unique on (eventId, userId). `onConflictDoNothing` for bulk assigns |

### Enums

- `group_role`: admin, member
- `availability_status`: open, closed
- `availability_response_value`: available, maybe, not_available
- `event_type`: rehearsal, show, other
- `assignment_status`: pending, confirmed, declined

### Indexes

- `users_email_idx`, `users_google_id_idx`
- `groups_invite_code_idx`
- `group_memberships_group_user_idx` (unique), `group_memberships_user_id_idx`
- `availability_requests_group_id_idx`
- `availability_responses_request_user_idx` (unique)
- `events_group_start_time_idx` (composite)
- `event_assignments_event_user_idx` (unique), `event_assignments_user_id_idx`

### JSON Column Patterns

```typescript
// availability_requests.requestedDates — array of ISO date strings
requestedDates: jsonb("requested_dates").$type<string[]>().notNull()
// Example: ["2025-03-15", "2025-03-16", "2025-03-17"]

// availability_responses.responses — map of date → status
responses: jsonb("responses").$type<Record<string, "available" | "maybe" | "not_available">>().notNull()
// Example: { "2025-03-15": "available", "2025-03-16": "maybe" }
```

## Development Setup

```bash
# Prerequisites: Node.js 20+, pnpm 9+, Docker

# 1. Install dependencies
pnpm install

# 2. Copy env vars
cp .env.example .env

# 3. Start PostgreSQL
docker compose up -d

# 4. Run migrations
pnpm run db:migrate

# 5. Start dev server (http://localhost:5173)
pnpm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/greenroom` |
| `SESSION_SECRET` | ✅ | Any random string for signing session cookies |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `APP_URL` | ✅ | `http://localhost:5173` locally |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Optional | For sending emails (logs to console if missing) |
| `LOG_LEVEL` | Optional | Pino log level: `trace`, `debug`, `info` (default), `warn`, `error`, `fatal` |

## Build, Test & Deploy Commands

| Command | What It Does |
|---------|--------------|
| `pnpm run dev` | Start Remix dev server with HMR |
| `pnpm run build` | Production build (Remix + Vite) |
| `pnpm run start` | Start production server (`remix-serve`) |
| `pnpm run typecheck` | `tsc --noEmit` (TypeScript strict mode) |
| `pnpm run lint` | Biome check (lint + format check) |
| `pnpm run lint:fix` | Biome auto-fix |
| `pnpm run format` | Biome format |
| `pnpm test` | Run Vitest |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm run db:generate` | Generate Drizzle migrations from schema changes |
| `pnpm run db:migrate` | Run pending migrations |
| `pnpm run db:studio` | Open Drizzle Studio (DB GUI) |

## How to Add a New Feature

1. **Schema** — Add tables/columns in `src/db/schema.ts` using Drizzle's `pgTable()`
2. **Migration** — Run `pnpm run db:generate` then `pnpm run db:migrate`
3. **Service** — Create `app/services/{feature}.server.ts` with query functions
4. **Route** — Add `app/routes/{path}.tsx` with loader/action + component
5. **Components** — Extract reusable UI to `app/components/`
6. **Auth** — Use `requireUser()`, `requireGroupMember()`, or `requireGroupAdmin()` in every loader/action
7. **Validate** — Run `pnpm run typecheck && pnpm run lint && pnpm run build`

### File Naming Conventions

- Routes: `app/routes/groups.$groupId.events.new.tsx` (flat dot notation)
- Services: `app/services/{domain}.server.ts` (`.server.ts` suffix required — Remix strips from client bundle)
- Components: `app/components/{name}.tsx` (kebab-case)
- DB schema: `src/db/schema.ts` (single file)

## Quality Gates

Before committing:
1. `pnpm run typecheck` — TypeScript strict mode, no errors
2. `pnpm run lint` — Biome linter passes
3. `pnpm run build` — Production build succeeds

CI runs on every push/PR to `master`: typecheck → lint → build → test

### Code Style

- **Formatter:** Biome — tabs, double quotes, semicolons, 100 char line width
- **Imports:** Auto-organized by Biome
- **CSS:** TailwindCSS v4 utility classes, emerald/slate color palette
- **Icons:** `lucide-react` exclusively
- **Components:** shadcn/ui patterns (Radix primitives, `cn()` utility from `src/lib/utils.ts`)

## Security Considerations

- **Every protected route** calls `requireUser()`, `requireGroupMember()`, or `requireGroupAdmin()` — never skip this
- **Cross-group isolation:** Always verify `resource.groupId === params.groupId` before returning data
- **Admin-only actions:** Settings, creating availability requests, creating events, managing assignments
- **Member verification for assignments:** `bulkAssignToEvent` verifies all userIds are group members before assigning
- **Invite codes:** 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, collision retry (up to 5 attempts)
- **Passwords:** bcrypt with 12 rounds, min 8 characters
- **Sessions:** httpOnly, sameSite lax, secure in production, 30-day expiry

## Known MVP Limitations

- No time slot selection (availability is per-date, not per-hour)
- No recurring availability requests
- No push notifications / reminder emails (button exists but disabled)
- No payments / subscription tiers
- No profile editing
- No group deletion
- No member role changes (admin can only remove members)
- Calendar view is read-only (no drag-to-create)

## Deployment

- **Platform:** Azure Container Apps
- **Container:** Node.js 20 slim, multi-stage Docker build (deps → build → runtime)
- **CI/CD:** GitHub Actions
  - `ci.yml` — typecheck + lint + build + test on push/PR to `master`
  - `deploy.yml` — Docker build → Azure Container Registry → Azure Container Apps on push to `master`
- **Database:** Azure PostgreSQL (SSL in production, `rejectUnauthorized: false`)

## Available Skills

- **greenroom-architecture** (`.github/skills/greenroom-architecture/`) — Remix route structure, loader/action patterns, service layer conventions, component architecture, and UI styling guidelines. Reference for how to build features that match the existing codebase.
- **greenroom-db** (`.github/skills/greenroom-db/`) — Drizzle ORM schema reference, migration workflow, query patterns (joins, upserts, transactions, window functions), JSON column patterns, index strategy, and multi-tenancy approach.
- **greenroom-testing** (`.github/skills/greenroom-testing/`) — Vitest configuration, testing Remix loaders/actions, mocking services and auth, test file structure, rate limiting and email testing patterns.
- **greenroom-security** (`.github/skills/greenroom-security/`) — Auth guard hierarchy, multi-tenancy isolation rules, rate limiting patterns, session security, password hashing, OAuth CSRF protection, and known security tech debt.
- **playwright-cli** (`.github/skills/playwright-cli/`) — Browser automation skill for web testing, demo recording, and screenshots. Use for end-to-end testing, capturing screenshots of UI flows, recording demo videos, and interacting with the app in a real browser. See `SKILL.md` for full command reference and `references/` for advanced topics (request mocking, session management, test generation, tracing, video recording).

## Known Issues / Tech Debt

- **No CSRF tokens on mutations:** Form actions rely on `sameSite: "lax"` cookies but do not include CSRF tokens. While `sameSite` mitigates most CSRF vectors, explicit tokens would provide defense-in-depth for state-changing operations.
- **`rejectUnauthorized: false` in production DB config:** The PostgreSQL connection uses `rejectUnauthorized: false` for SSL in production (see `src/db/index.ts`). This disables certificate validation and makes the connection vulnerable to man-in-the-middle attacks. Should be replaced with a proper CA certificate.
- **Date serialization workarounds:** Remix serializes `Date` objects to strings when passing from loader to component. The codebase uses `as unknown as string` casts (e.g., in `groups.$groupId._index.tsx` for `startTime`/`endTime`). This is a known Remix limitation — consider a serialization helper or using ISO strings from the service layer.
