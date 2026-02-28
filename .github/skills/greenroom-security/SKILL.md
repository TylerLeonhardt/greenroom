---
name: greenroom-security
description: My Call Time security patterns, auth guards, multi-tenancy isolation, and rate limiting
---

# My Call Time Security Patterns

## Auth Guard Hierarchy

My Call Time uses three levels of auth protection. Choose the correct guard based on what the route does:

### `requireUser(request)` — Any Authenticated User

**When to use:** Routes not scoped to a specific group (dashboard, profile, group list, creating a new group).

**What it does:** Checks the session cookie for a valid `userId`. If not found, redirects to `/login`.

**Location:** `app/services/auth.server.ts`

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  // user is guaranteed to be authenticated
  const groups = await getUserGroups(user.id);
  return { groups };
}
```

### `requireGroupMember(request, groupId)` — Group Member

**When to use:** Any route scoped to a group where read access is sufficient (viewing events, availability requests, member list).

**What it does:** Calls `requireUser()` internally, then verifies the user is a member of the specified group. Throws 404 if not a member (prevents group ID enumeration).

**Location:** `app/services/groups.server.ts`

```typescript
export async function loader({ request, params }: LoaderFunctionArgs) {
  const groupId = params.groupId ?? "";
  const user = await requireGroupMember(request, groupId);
  const events = await getGroupEvents(groupId);
  return { events, userId: user.id };
}
```

### `requireGroupAdmin(request, groupId)` — Group Admin

**When to use:** Routes where only admins should have access — creating events, creating availability requests, editing group settings, managing members.

**What it does:** Calls `requireUser()` internally, then verifies the user has `role: "admin"` for the specified group. Throws 403 if not admin.

**Location:** `app/services/groups.server.ts`

```typescript
export async function action({ request, params }: ActionFunctionArgs) {
  const groupId = params.groupId ?? "";
  const user = await requireGroupAdmin(request, groupId);
  // Only admins reach this point
  await deleteEvent(eventId);
  return redirect(`/groups/${groupId}/events`);
}
```

### `getOptionalUser(request)` — Optional Auth

**When to use:** Only in `app/root.tsx` for the navigation bar. Shows different nav based on whether user is logged in.

**What it does:** Returns `AuthUser | null` without redirecting.

---

## Multi-Tenancy Isolation

My Call Time enforces data isolation at the application layer, not through PostgreSQL Row-Level Security. This means every query must explicitly filter by group.

### Rule 1: Every Group Query Filters by `groupId`

```typescript
// ✅ CORRECT: filters by groupId
const events = await db.select()
  .from(events)
  .where(eq(events.groupId, groupId));

// ❌ WRONG: no groupId filter — returns events from ALL groups
const events = await db.select()
  .from(events);
```

### Rule 2: Validate Resource Ownership Before Returning Data

When loading a resource by its ID from URL params, always verify it belongs to the current group:

```typescript
// In groups.$groupId.availability.$requestId.tsx loader
const availRequest = await getAvailabilityRequest(requestId);
if (!availRequest || availRequest.groupId !== groupId) {
  throw new Response("Not Found", { status: 404 });
}
```

```typescript
// In groups.$groupId.events.$eventId.tsx loader
const data = await getEventWithAssignments(eventId);
if (!data || data.event.groupId !== groupId) {
  throw new Response("Not Found", { status: 404 });
}
```

### Rule 3: Dashboard Queries Scope Through Memberships

Cross-group queries (like the dashboard showing events from all of a user's groups) must JOIN through `group_memberships`:

```typescript
// Scoped through membership — only shows the user's groups
const events = await db.select({ ... })
  .from(events)
  .innerJoin(groups, eq(events.groupId, groups.id))
  .innerJoin(groupMemberships, and(
    eq(groupMemberships.groupId, groups.id),
    eq(groupMemberships.userId, userId)
  ))
  .where(gte(events.startTime, new Date()));
```

### Rule 4: Verify Membership for Bulk Operations

When assigning members to an event, verify all user IDs are actually members of the group:

```typescript
// In events.server.ts — bulkAssignToEvent validates membership
const memberRows = await db.select({ userId: groupMemberships.userId })
  .from(groupMemberships)
  .where(and(
    eq(groupMemberships.groupId, groupId),
    inArray(groupMemberships.userId, userIds)
  ));
// Only assign verified members
```

---

## Rate Limiting

In-memory sliding window rate limiter at `app/services/rate-limit.server.ts`.

### Available Functions

```typescript
import {
  checkLoginRateLimit,    // 10 requests/min per IP
  checkSignupRateLimit,   // 5 requests/min per IP
  checkRateLimit,         // generic: checkRateLimit(key, maxRequests, windowMs)
  _resetForTests,         // clears all state (for tests only)
} from "~/services/rate-limit.server";
```

### Usage in Route Actions

```typescript
export async function action({ request }: ActionFunctionArgs) {
  // Rate limit check BEFORE any expensive operations
  const rateLimit = checkLoginRateLimit(request);
  if (rateLimit.limited) {
    return json(
      { error: `Too many login attempts. Try again in ${rateLimit.retryAfter} seconds.` },
      { status: 429 }
    );
  }

  // Now proceed with bcrypt comparison, DB queries, etc.
  const formData = await request.formData();
  // ...
}
```

### Currently Protected Routes

| Route | Function | Limit |
|-------|----------|-------|
| `/login` (action) | `checkLoginRateLimit` | 10 req/min per IP |
| `/signup` (action) | `checkSignupRateLimit` | 5 req/min per IP |

### How It Works

1. Client IP extracted from `x-forwarded-for` header (Azure Container Apps proxy sets this)
2. Key format: `login:<ip>` or `signup:<ip>`
3. Sliding window: tracks timestamps of recent requests within the window
4. When limit exceeded, returns `{ limited: true, retryAfter: <seconds> }`
5. Stale entries cleaned up every 5 minutes

### Limitations

- In-memory storage — state is lost on restart and not shared across replicas
- For multi-instance deployments, consider Redis-backed rate limiting

---

## Session Security

### Cookie Configuration

Defined in `app/services/session.server.ts`:

```typescript
createCookieSessionStorage({
  cookie: {
    name: "__greenroom_session",
    httpOnly: true,          // Not accessible via JavaScript
    maxAge: 60 * 60 * 24 * 30, // 30-day expiry
    path: "/",
    sameSite: "lax",         // Mitigates CSRF for cross-site navigation
    secrets: [sessionSecret], // Signed with SESSION_SECRET env var
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
  },
});
```

### Session Data

The session stores:
- `userId` — the authenticated user's UUID (set by `createUserSession()`)
- `oauth_state` — temporary CSRF token for Google OAuth flow (set by `getGoogleAuthURL()`)

### `SESSION_SECRET` Requirement

`SESSION_SECRET` is validated at module load time. If not set, the app crashes immediately:

```typescript
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}
```

This means `SESSION_SECRET` must be set even in test environments. Vitest handles this in `vitest.config.ts`:

```typescript
test: {
  env: {
    SESSION_SECRET: "test-secret-for-vitest",
  },
}
```

---

## Password Security

### Hashing

- Algorithm: bcrypt
- Cost factor: 12 rounds
- Minimum length: 8 characters (validated in signup action)
- `passwordHash` is `null` for Google-only OAuth users

```typescript
// Registration
const passwordHash = await bcrypt.hash(password, 12);

// Login verification
const isValid = await bcrypt.compare(password, user.passwordHash);
```

---

## Google OAuth CSRF Protection

My Call Time uses the OAuth `state` parameter to prevent CSRF attacks on the callback:

### Flow

1. **`getGoogleAuthURL(request)`** generates a cryptographic random state:
   ```typescript
   const state = crypto.randomBytes(32).toString("hex");
   session.set("oauth_state", state);
   ```
   The state is stored in the session cookie and included in the Google auth URL.

2. **Callback handler** verifies the state from the URL matches the session:
   ```typescript
   const storedState = session.get("oauth_state");
   return crypto.timingSafeEqual(Buffer.from(storedState), Buffer.from(state));
   ```
   Uses `timingSafeEqual` to prevent timing attacks.

3. If state doesn't match, the callback rejects the request — preventing an attacker from initiating an OAuth flow and tricking a user into completing it.

---

## Invite Code Security

- 8 characters from charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (28 chars, no ambiguous I/O/0/1)
- Entropy: ~38 bits (28^8 ≈ 377 billion combinations)
- Generated with `crypto.randomInt()` for uniform distribution
- Collision retry: up to 5 attempts with unique index as final safeguard
- Stored with unique index on `groups.inviteCode`

---

## Known Security Tech Debt

1. **No CSRF tokens on form mutations:** Relies on `sameSite: "lax"` cookies. While this mitigates most CSRF vectors, explicit tokens would provide defense-in-depth. ([#24](https://github.com/TylerLeonhardt/greenroom/issues/24))

2. **`rejectUnauthorized: false` in production SSL:** The PostgreSQL connection skips certificate validation (`src/db/index.ts`). Vulnerable to MITM attacks between the app container and database. Fix: bundle the Azure CA certificate. ([#23](https://github.com/TylerLeonhardt/greenroom/issues/23))

3. **In-memory rate limiting:** State not shared across replicas. An attacker could distribute requests across multiple app instances. Fix: Redis-backed rate limiter. ([#27](https://github.com/TylerLeonhardt/greenroom/issues/27))

4. **No account lockout:** Failed login attempts are rate-limited by IP, but there's no per-account lockout after N failed attempts. An attacker using distributed IPs can still brute-force a specific account.

5. **No email verification on signup:** `emailVerified` defaults to `false` for email/password users, but there's no verification flow. Users can sign up with any email address.

6. **No security headers:** Missing X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, CSP, Referrer-Policy. ([#22](https://github.com/TylerLeonhardt/greenroom/issues/22))

7. **No account deletion / GDPR path:** Users cannot delete their accounts or request data deletion. ([#25](https://github.com/TylerLeonhardt/greenroom/issues/25))

8. **Email enumeration on signup:** Registration reveals whether an email is already registered. ([#26](https://github.com/TylerLeonhardt/greenroom/issues/26))

---

## Security Patterns to Follow

### Action IDOR Prevention

Every route action that mutates a group-scoped resource MUST verify the resource belongs to the group before performing the mutation. The loader verification is not sufficient — actions must independently verify.

```typescript
// ✅ CORRECT: verify ownership in action before mutation
export async function action({ request, params }) {
  const groupId = params.groupId ?? "";
  const eventId = params.eventId ?? "";
  await requireGroupAdmin(request, groupId);

  // Verify event belongs to this group BEFORE any mutation
  const data = await getEventWithAssignments(eventId);
  if (!data || data.event.groupId !== groupId) {
    throw new Response("Not Found", { status: 404 });
  }

  // Now safe to mutate
  await deleteEvent(eventId);
}
```

### Email HTML Escaping

All user-controlled content interpolated into HTML email templates must be escaped with `escapeHtml()`:

```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// In email templates:
const html = emailLayout(`
  <p>${escapeHtml(options.groupName)}</p>
  <p>${escapeHtml(options.eventTitle)}</p>
  <p>${escapeHtml(recipient.name)}</p>
`);
```

### JSON Input Validation

Always validate JSONB data from user input before storing:

```typescript
const validStatuses = new Set(["available", "maybe", "not_available"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
for (const [key, value] of Object.entries(responses)) {
  if (!datePattern.test(key) || !validStatuses.has(value)) {
    return { error: "Invalid response data." };
  }
}
```

### PII in Logs

Never log email addresses or other PII. Log counts or anonymized identifiers instead:

```typescript
// ❌ BAD: logs email addresses
logger.info({ to: recipients }, "Email not sent");

// ✅ GOOD: logs count only
logger.info({ recipientCount: recipients.length }, "Email not sent");
```
