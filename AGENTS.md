# My Call Time — Agent Notes

Read [`docs/vision.md`](docs/vision.md) first to understand the product vision and principles before starting any work.

Institutional knowledge for agents working on the My Call Time codebase. Read this before touching anything.

## What Is My Call Time?

My Call Time is a scheduling platform for improv groups. It solves the "when is everyone free?" problem that every improv troupe, ensemble, or comedy team faces. An admin creates an availability request, members respond with Available/Maybe/Unavailable per date, and the admin sees a heatmap of the best dates to schedule rehearsals or shows.

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
│   ├── api.events.$eventId.ics.tsx # iCal export (GET, role-aware start times)
│   ├── $.tsx                   # Catch-all 404 page
│   ├── dashboard.tsx           # Authenticated dashboard (requires login)
│   ├── groups.tsx              # Groups layout (Outlet wrapper)
│   ├── groups._index.tsx       # Groups list with inline join/create forms
│   ├── groups.new.tsx          # Create group form
│   ├── groups.join.tsx         # Join group via invite code (supports ?code= param)
│   ├── groups.$groupId.tsx     # Group layout with tab navigation (Outlet)
│   ├── groups.$groupId._index.tsx        # Group overview: members, stats, upcoming events
│   ├── groups.$groupId.availability.tsx  # Availability layout (Outlet wrapper)
│   ├── groups.$groupId.availability._index.tsx  # Availability request list with progress bars
│   ├── groups.$groupId.availability.new.tsx     # Create availability request (admin or permitted member)
│   ├── groups.$groupId.availability.$requestId.tsx  # View/respond to request + results heatmap
│   ├── groups.$groupId.events.tsx        # Events layout (Outlet wrapper)
│   ├── groups.$groupId.events._index.tsx # Event list (list/calendar toggle) with type filter
│   ├── groups.$groupId.events.new.tsx    # Create event (admin or permitted member, supports ?fromRequest=)
│   ├── groups.$groupId.events.$eventId.tsx      # Event detail: cast list, confirm/decline
│   ├── groups.$groupId.events.$eventId.edit.tsx # Edit/delete event (admin)
│   ├── groups.$groupId.settings.tsx      # Group settings: edit name, permissions, regenerate invite code
│   └── settings.tsx              # User settings: timezone preference
├── services/                   # Server-side business logic (*.server.ts)
│   ├── auth.server.ts          # Authentication: form strategy, Google OAuth, requireUser()
│   ├── session.server.ts       # Cookie session storage, getUserId(), createUserSession()
│   ├── groups.server.ts        # Group CRUD, membership, invite codes, permissions, requireGroupMember/Admin/AdminOrPermission
│   ├── availability.server.ts  # Availability requests, responses, aggregation
│   ├── events.server.ts        # Events CRUD, assignments, bulk assign, cross-group queries
│   ├── dashboard.server.ts     # Dashboard data aggregation (parallel queries)
│   ├── email.server.ts         # Azure Communication Services email with graceful fallback
│   ├── logger.server.ts        # Pino structured logger, configurable via LOG_LEVEL env var
│   ├── rate-limit.server.ts    # In-memory sliding window rate limiter for auth routes
│   └── telemetry.server.ts     # Application Insights SDK init + getTelemetryClient() helper
└── components/                 # Reusable React components
    ├── availability-grid.tsx   # Date × status grid for submitting availability
    ├── date-selector.tsx       # Calendar-based date picker for creating requests
    ├── event-calendar.tsx      # Monthly calendar view with event dots
    ├── event-card.tsx          # Reusable event card (used in dashboard, lists, sidebar)
    ├── results-heatmap.tsx     # Aggregated availability results with scoring
    └── timezone-selector.tsx   # Inline timezone picker (used in availability/event creation)

src/
├── db/
│   ├── schema.ts               # Drizzle ORM schema (all tables, enums, indexes)
│   └── index.ts                # Database connection (pg Pool + drizzle)
└── lib/
    └── utils.ts                # cn() utility (clsx + tailwind-merge)

app/lib/
└── date-utils.ts               # Centralized date/time formatting (Intl.DateTimeFormat)
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

// Admin OR member with a specific group-level permission enabled — throws 403 if neither
const user = await requireGroupAdminOrPermission(request, groupId, "membersCanCreateRequests");
```

- `getOptionalUser(request)` returns `AuthUser | null` (used in root loader for nav)
- Auth uses `remix-auth` with `FormStrategy` for email/password
- Google OAuth is manual implementation (not using remix-auth-google adapter) — see `getGoogleAuthURL()`, `exchangeGoogleCode()`, `findOrCreateGoogleUser()`
- Session is a signed cookie (`__greenroom_session`, 30 day expiry)
- **Session = verified user.** Signup does NOT create a session. Users must verify their email first, then log in. Login blocks unverified users. There is no "logged in but unverified" state.

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

- If `AZURE_COMMUNICATION_CONNECTION_STRING` is not set, emails log via pino instead of throwing
- `sendEmail()` returns `{ success: boolean; error?: string }` — never throws
- Email sending never blocks the user's request/response cycle
- `sendEventFromAvailabilityNotification()` — availability-aware: sends targeted emails based on member's response (available/maybe/no response). Does NOT email people who said "not_available".

### Show Events & Performer/Viewer Roles

Show events (`eventType === 'show'`) have special behavior:

- **Call Time:** `callTime` column (nullable timestamp) stores when performers need to arrive. Only used for shows.
- **Cast Assignment:** When creating a show, admins can select performers. Selected members get `role = "Performer"` in `event_assignments`.
- **Self-Registration:** Any group member can click "I'll be there" to add themselves as a `Viewer` (auto-confirmed).
- **iCal Export:** Performers get `callTime` as their calendar event start; viewers get `startTime`. Route: `/api/events/:eventId/ics?role=Performer`.
- **Availability Pre-selection:** When creating from an availability request, members who said "available" are pre-checked.

```typescript
// Assigning performers during event creation
await bulkAssignToEvent(event.id, performerIds, "Performer");

// Self-registration as viewer
await assignToEvent(eventId, user.id, "Viewer");
await updateAssignmentStatus(eventId, user.id, "confirmed");
```

### Date & Time Formatting

All date/time formatting goes through `app/lib/date-utils.ts` — the **single source of truth** for formatting. Never use inline `toLocaleDateString()`, `toLocaleTimeString()`, or manual date string manipulation.

```typescript
import {
  formatDate,        // "Wed, Mar 4, 2026"
  formatTime,        // "7:00 PM"
  formatDateTime,    // "Wed, Mar 4 · 7:00 PM"
  formatDateRange,   // "Mar 1 – Mar 28, 2026"
  formatEventTime,   // "Wed, Mar 4 · 7:00 PM – 9:00 PM" (with callTime support)
  formatDateDisplay, // "Sat Mar 15" (short, for grids)
  formatDateLong,    // "Saturday, March 15, 2025" (full)
  formatDateMedium,  // "Mar 15, 2025"
  formatDateShort,   // "Mar 15"
  formatTimeRange,   // "7:00 PM – 9:00 PM" (from "HH:MM" strings)
} from "~/lib/date-utils";
```

All functions accept an optional `timezone?: string` parameter (IANA timezone, e.g., `"America/Los_Angeles"`). When omitted, uses the runtime's default timezone. For server-side rendering, pass the user's stored timezone from `user.timezone`.

**User timezone preference:** Stored in `users.timezone` column (nullable varchar). Auto-detected on first visit via `Intl.DateTimeFormat().resolvedOptions().timeZone` and saved via the settings page (`/settings`). Falls back to UTC if not set.

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
| `/signup` | Public | Registration form with password strength meter. Redirects to `/check-email` after signup (no session created). |
| `/logout` | POST only | Destroys session, redirects to `/` |
| `/check-email` | Public | Email verification prompt. Accepts `?email=` query param. Supports resend verification email. |
| `/verify-email` | Public | Validates email verification token from `?token=`. Redirects to `/login?verified=true` on success. |
| `/auth/google` | Public | Redirects to Google OAuth consent screen |
| `/auth/google/callback` | Public | Handles OAuth code exchange, creates session |
| `/api/health` | Public | Returns `{ status: "ok", timestamp }` |
| `/api/events/:eventId/ics` | `requireUser` + `requireGroupMember` | Downloads .ics file (role-aware start times for performers) |
| `/dashboard` | `requireUser` | Action items, upcoming events, group list |
| `/settings` | `requireUser` | Timezone preference, auto-detects on first visit |
| `/groups` | `requireUser` | Layout (Outlet wrapper) |
| `/groups` (index) | `requireUser` | List user's groups + inline join form |
| `/groups/new` | `requireUser` | Create group form |
| `/groups/join` | `requireUser` | Join via invite code (supports `?code=` query param) |
| `/groups/:groupId` | `requireGroupMember` | Layout with tabs: Overview, Availability, Events, Settings |
| `/groups/:groupId` (index) | `requireGroupMember` | Member list, quick stats, upcoming events sidebar |
| `/groups/:groupId/availability` | `requireGroupMember` | Layout (Outlet wrapper) |
| `/groups/:groupId/availability` (index) | `requireGroupMember` | List availability requests with progress bars |
| `/groups/:groupId/availability/new` | `requireGroupAdminOrPermission` | Create availability request with date picker |
| `/groups/:groupId/availability/:requestId` | `requireGroupMember` | Submit response + admin results heatmap |
| `/groups/:groupId/events` | `requireGroupMember` | Layout (Outlet wrapper) |
| `/groups/:groupId/events` (index) | `requireGroupMember` | Event list (list/calendar toggle) with type filter |
| `/groups/:groupId/events/new` | `requireGroupAdminOrPermission` | Create event (supports `?fromRequest=&date=`) |
| `/groups/:groupId/events/:eventId` | `requireGroupMember` | Event detail, cast list, confirm/decline |
| `/groups/:groupId/events/:eventId/edit` | `requireGroupAdmin` | Edit/delete event |
| `/groups/:groupId/settings` | `requireGroupAdmin` | Edit group name/description, regenerate invite code |

## Database Schema

6 tables + 5 enums. All PKs are UUIDs (`defaultRandom()`). All timestamps are `with time zone`.

### Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, email (unique), passwordHash, name, googleId (unique), emailVerified, timezone | Supports email/password + Google OAuth. `passwordHash` is null for Google-only users. `timezone` is IANA timezone string, auto-detected on first visit |
| `groups` | id, name, description, inviteCode (unique, 8 chars), createdById → users, membersCanCreateRequests, membersCanCreateEvents | Invite code uses chars `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous I/O/0/1). Permission booleans default to `false` (admin-only). |
| `group_memberships` | id, groupId → groups, userId → users, role (admin/member) | Unique on (groupId, userId). Creator gets admin role |
| `availability_requests` | id, groupId → groups, title, requestedDates (JSONB `string[]`), status (open/closed), expiresAt, requestedStartTime, requestedEndTime | `requestedDates` is a JSON array of ISO date strings. `requestedStartTime`/`requestedEndTime` are nullable "HH:MM" strings for time range (null = all day) |
| `availability_responses` | id, requestId → availability_requests, userId → users, responses (JSONB) | `responses` is `Record<string, "available" | "maybe" | "not_available">`. Upsert on (requestId, userId) |
| `events` | id, groupId → groups, title, eventType, startTime, endTime, callTime, location, createdFromRequestId | Links back to availability request if created from one. `callTime` is nullable (only for shows — performer arrival time) |
| `event_assignments` | id, eventId → events, userId → users, role, status (pending/confirmed/declined) | Unique on (eventId, userId). `onConflictDoNothing` for bulk assigns. Role values: "Performer" (shows), "Viewer" (self-registered attendees) |

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
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Optional | Azure Application Insights connection string for production telemetry (graceful no-op if missing) |
| `SUPPORT_URL` | Optional | URL for "Buy me a coffee" link in landing page footer (hidden if not set) |

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
- **Admin-only actions:** Settings, managing assignments, editing/deleting events, closing/reopening availability requests
- **Configurable member permissions:** Admins can enable `membersCanCreateRequests` and `membersCanCreateEvents` per group (default: disabled). Routes use `requireGroupAdminOrPermission()` for these actions.
- **Member verification for assignments:** `bulkAssignToEvent` verifies all userIds are group members before assigning
- **Invite codes:** 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, collision retry (up to 5 attempts)
- **Passwords:** bcrypt with 12 rounds, min 8 characters
- **Sessions:** httpOnly, sameSite lax, secure in production, 30-day expiry

## Known MVP Limitations

- No recurring availability requests
- No push notifications / reminder emails (button exists but disabled)
- No payments / subscription tiers
- No group deletion
- No member role changes (admin can only remove members)
- Calendar view is read-only (no drag-to-create)

## Deployment

- **Platform:** Azure Container Apps
- **Container:** Node.js 20 slim, multi-stage Docker build (deps → build → runtime)
- **CI/CD:** GitHub Actions
  - `ci.yml` — typecheck + lint + build + test on push/PR to `master`
  - `deploy.yml` — Docker build → Azure Container Registry → Azure Container Apps on push to `master`
- **Database:** Azure PostgreSQL (SSL in production, verified against DigiCert Global Root G2 CA cert in `certs/`)

## Observability

Production telemetry is powered by Azure Application Insights, initialized in `app/services/telemetry.server.ts`.

### How It Works

- **Auto-instrumentation:** The `applicationinsights` SDK is imported at the very top of `app/entry.server.tsx` (before all other imports) so it can patch Node.js modules for automatic request, exception, dependency, and performance tracking.
- **Graceful degradation:** If `APPLICATIONINSIGHTS_CONNECTION_STRING` is not set, telemetry is a no-op — the app runs normally without any monitoring overhead.
- **Custom email telemetry:** `sendEmail()` in `app/services/email.server.ts` tracks `EmailSent` events (with success/failure) and exceptions via `getTelemetryClient()`.

### Azure Resources

| Resource | Name | Resource Group |
|----------|------|----------------|
| Application Insights | `mycalltime-insights` | `greenroom-rg` |
| Log Analytics Workspace | `workspace-greenroomrgLC11` | `greenroom-rg` |
| Action Group (alerts) | `mycalltime-alerts` | `greenroom-rg` |
| Availability Test | `mycalltime-health-ping` | `greenroom-rg` |

### Alert Rules

| Alert | Type | Condition | Severity | Window |
|-------|------|-----------|----------|--------|
| `mycalltime-exception-spike` | Scheduled Query | >5 exceptions in 5 min | Sev 1 | 5 min |
| `mycalltime-slow-response` | Metric | Avg response time >5s | Sev 2 | 5 min |
| `mycalltime-availability-alert` | Webtest Availability | ≥2 locations fail | Sev 1 | 3 min |

All alerts notify the `mycalltime-alerts` action group (tylerl0706@gmail.com).

The **availability test** (`mycalltime-health-ping`) pings `https://mycalltime.app/api/health` every 5 minutes from 5 locations (US East, US West, UK, Netherlands, Hong Kong). It validates HTTP 200 and SSL certificate validity (7-day expiry warning).

```bash
# List alert rules
az monitor scheduled-query list -g greenroom-rg -o table
az monitor metrics alert list -g greenroom-rg -o table

# Check availability test status
az rest --method GET \
  --url "https://management.azure.com/subscriptions/b37965f1-4da2-4202-889d-82322392b4d5/resourceGroups/greenroom-rg/providers/Microsoft.Insights/webtests?api-version=2022-06-15" \
  --query "value[].{name:name, enabled:properties.Enabled}" -o table
```

### Viewing Telemetry

```bash
# View recent exceptions
az monitor app-insights query --apps mycalltime-insights -g greenroom-rg \
  --analytics-query "exceptions | where timestamp > ago(1h) | project timestamp, problemId, outerMessage | order by timestamp desc | take 20"

# View request performance
az monitor app-insights query --apps mycalltime-insights -g greenroom-rg \
  --analytics-query "requests | where timestamp > ago(1h) | summarize avg(duration), count() by name | order by count_ desc"

# View email events
az monitor app-insights query --apps mycalltime-insights -g greenroom-rg \
  --analytics-query "customEvents | where name == 'EmailSent' | where timestamp > ago(24h) | summarize count() by tostring(customDimensions.success)"

# Live tail logs
az containerapp logs show --name greenroom -g greenroom-rg --follow
```

### Adding Custom Telemetry

```typescript
import { getTelemetryClient } from "~/services/telemetry.server";

// Track custom events (null-safe — no-op when App Insights is not configured)
getTelemetryClient()?.trackEvent({ name: "MyEvent", properties: { key: "value" } });
getTelemetryClient()?.trackException({ exception: error });
```

## Available Skills

- **greenroom-architecture** (`.github/skills/greenroom-architecture/`) — Remix route structure, loader/action patterns, service layer conventions, component architecture, and UI styling guidelines. Reference for how to build features that match the existing codebase.
- **greenroom-db** (`.github/skills/greenroom-db/`) — Drizzle ORM schema reference, migration workflow, query patterns (joins, upserts, transactions, window functions), JSON column patterns, index strategy, and multi-tenancy approach.
- **schema-changes** (`.github/skills/schema-changes/`) — **Required reading before any schema change.** Checklist covering write-site discovery, NOT NULL pitfalls, migration defaults, lifecycle testing, FK cascades, and LEFT JOIN awareness. Born from a production bug where Drizzle `.default()` didn't propagate to the DB.
- **greenroom-testing** (`.github/skills/greenroom-testing/`) — Vitest configuration, testing Remix loaders/actions, mocking services and auth, test file structure, rate limiting and email testing patterns.
- **greenroom-security** (`.github/skills/greenroom-security/`) — Auth guard hierarchy, multi-tenancy isolation rules, rate limiting patterns, session security, password hashing, OAuth CSRF protection, and known security tech debt.
- **playwright-cli** (`.github/skills/playwright-cli/`) — Browser automation skill for web testing, demo recording, and screenshots. Use for end-to-end testing, capturing screenshots of UI flows, recording demo videos, and interacting with the app in a real browser. See `SKILL.md` for full command reference and `references/` for advanced topics (request mocking, session management, test generation, tracing, video recording).
- **azure-diagnostics** (`.github/skills/azure-diagnostics/`) — Azure resource diagnostics and troubleshooting. Covers Container Apps debugging (log analysis, health checks, image pull failures), Azure Functions diagnostics, Azure Resource Graph queries, and KQL query patterns. Essential for production incident response. Source: [microsoft/GitHub-Copilot-for-Azure](https://github.com/microsoft/GitHub-Copilot-for-Azure).
- **azure-deploy** (`.github/skills/azure-deploy/`) — Azure deployment workflows including pre-deploy checklists, troubleshooting, region availability, and deployment recipes for Azure CLI, azd, Bicep, Terraform, and CI/CD pipelines (GitHub Actions & Azure DevOps). Includes Azure Identity SDK references for multiple languages. Source: [microsoft/GitHub-Copilot-for-Azure](https://github.com/microsoft/GitHub-Copilot-for-Azure).
- **azure-cost-optimization** (`.github/skills/azure-cost-optimization/`) — Azure cost analysis and optimization. Covers Azure Quick Review, orphaned resource cleanup, rightsizing, Redis cache analysis, Azure Resource Graph cost queries, and spending analysis templates. Source: [microsoft/GitHub-Copilot-for-Azure](https://github.com/microsoft/GitHub-Copilot-for-Azure).
- **azure-observability** (`.github/skills/azure-observability/`) — Azure Monitor, Application Insights, and Log Analytics. Covers OpenTelemetry instrumentation (Python, TypeScript, Java), log ingestion, metric queries, and Application Insights management SDK references. Source: [microsoft/GitHub-Copilot-for-Azure](https://github.com/microsoft/GitHub-Copilot-for-Azure).

## Known Issues / Tech Debt

- **Date serialization workarounds:** Remix serializes `Date` objects to strings when passing from loader to component. The codebase uses `as unknown as string` casts (e.g., in `groups.$groupId._index.tsx` for `startTime`/`endTime`). This is a known Remix limitation — consider a serialization helper or using ISO strings from the service layer.
- **In-memory rate limiting:** Rate limiting uses an in-memory sliding window (`app/services/rate-limit.server.ts`). This works for single-instance deployments but does not share state across multiple container replicas. For multi-instance deployments, consider Redis-backed rate limiting.
