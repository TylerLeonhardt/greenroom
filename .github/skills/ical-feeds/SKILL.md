---
name: ical-feeds
description: iCalendar (RFC 5545) feed generation, token-based auth for non-browser clients, and the subscribable calendar feed feature
---

# iCalendar Feed Patterns

## Overview

My Call Time exposes a subscribable iCalendar feed at `/api/calendar/:token.ics`. Calendar apps (Google Calendar, Apple Calendar, Outlook) can poll this URL to stay in sync with a user's events across all their groups.

Key difference from the per-event `.ics` export (`/api/events/:eventId/ics`): the feed is **multi-event**, **cross-group**, and uses **token-based auth** instead of cookie sessions — because calendar apps can't authenticate with browser cookies.

## File Map

| File | Purpose |
|------|---------|
| `app/lib/ical-utils.ts` | Shared iCal formatting functions (RFC 5545 compliant) |
| `app/lib/ical-utils.test.ts` | Unit tests for iCal utils |
| `app/routes/api.calendar.$token.ics.tsx` | Feed route (loader only, no action) |
| `app/routes/api.calendar.$token.ics.test.ts` | Route tests |
| `app/services/calendar-token.server.ts` | Token CRUD (generate, read, revoke via regenerate) |
| `src/db/schema.ts` → `calendarTokens` | Schema: one token per user, cascade delete |

## iCal Format (RFC 5545 Basics)

### Date-Time Formatting

All times are UTC. Format: `YYYYMMDDTHHMMSSZ` — no dashes, no colons, no milliseconds.

```typescript
// app/lib/ical-utils.ts
export function formatICalDate(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
}
// new Date("2026-03-15T19:00:00Z") → "20260315T190000Z"
```

Using UTC throughout means we don't need `VTIMEZONE` components.

### Text Escaping (RFC 5545 §3.3.11)

Four characters must be escaped in TEXT property values:

```typescript
export function escapeICalText(text: string): string {
	return text
		.replace(/\\/g, "\\\\")   // backslash first (avoid double-escaping)
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");   // literal newline → iCal \n escape
}
```

**Order matters:** Backslashes must be escaped first, otherwise you'll double-escape the backslashes from subsequent replacements.

### Line Folding (RFC 5545 §3.1)

Content lines must be folded at 75 octets. Continuation lines start with a single space:

```typescript
export function foldLine(line: string): string {
	const maxLen = 75;
	if (line.length <= maxLen) return line;
	const parts: string[] = [];
	parts.push(line.slice(0, maxLen));
	let i = maxLen;
	while (i < line.length) {
		parts.push(` ${line.slice(i, i + maxLen - 1)}`);
		i += maxLen - 1;
	}
	return parts.join("\r\n");
}
```

**Note:** This implementation uses JS string length (code units), not byte/octet count. For ASCII-only content (which our data largely is), this is fine. If we add emoji or non-ASCII text in event titles, this could break — see Pitfalls below.

### CRLF Line Endings

RFC 5545 requires `\r\n` (CRLF) between content lines, not bare `\n`. The feed joins all lines with `\r\n`:

```typescript
return lines.join("\r\n");
```

## Feed Generation (`generateCalendarFeed`)

The `generateCalendarFeed(calendarEvents: CalendarEvent[]): string` function in `app/lib/ical-utils.ts` builds a full `VCALENDAR` document:

### VCALENDAR Envelope

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//My Call Time//Calendar Feed//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:My Call Time
```

- `METHOD:PUBLISH` signals this is a read-only feed (not a scheduling request)
- `X-WR-CALNAME` sets the calendar name shown in apps like Google Calendar

### VEVENT Per Event

Each event produces a `VEVENT` block with:

| Property | Source | Notes |
|----------|--------|-------|
| `UID` | `${event.id}@mycalltime.app` | Stable across refreshes — calendar apps use this to detect updates |
| `DTSTAMP` | `new Date()` (generation time) | When the feed was generated |
| `DTSTART` | `startTime` or `callTime` | See performer logic below |
| `DTEND` | `endTime` | Always the event's end time |
| `LAST-MODIFIED` | `updatedAt` | Tells calendar apps when the event was last changed |
| `SUMMARY` | `title` | Escaped via `escapeICalText` |
| `DESCRIPTION` | `"Group: {groupName}\n{description}"` | Optional; omitted if both empty |
| `LOCATION` | `location` | Optional; omitted if null |
| `CATEGORIES` | `groupName` | Allows filtering by group in calendar apps |

### Performer Call Time Logic

For shows, performers see `callTime` (when they need to arrive) instead of `startTime` (when the show starts for the audience):

```typescript
const isPerformerAtShow =
	event.userRole === "Performer" && event.eventType === "show" && event.callTime;
const startTime = isPerformerAtShow ? (event.callTime as Date) : event.startTime;
```

All three conditions must be true: role is Performer, event type is show, AND callTime exists.

### CalendarEvent Interface

```typescript
export interface CalendarEvent {
	id: string;
	title: string;
	description: string | null;
	location: string | null;
	startTime: Date;
	endTime: Date;
	callTime: Date | null;
	eventType: string;
	groupName: string;
	userRole: string | null;
	updatedAt: Date;
}
```

## Token-Based Auth

### Why Not Cookies?

Calendar apps (Google Calendar, Apple Calendar, Outlook) subscribe to a URL and poll it periodically. They can't:
- Visit a login page
- Store browser cookies
- Follow OAuth flows

So we use a **secret URL** pattern: the token IS the authentication. Anyone with the URL can read the feed.

### Token Lifecycle

Managed via `app/services/calendar-token.server.ts`:

```typescript
// Read existing token for a user (null if none)
getCalendarToken(userId: string): Promise<string | null>

// Generate or replace token — crypto.randomBytes(32) → 64-char hex
regenerateCalendarToken(userId: string): Promise<string>

// Look up user by token (rejects soft-deleted users)
getUserByCalendarToken(token: string): Promise<{ id: string; timezone: string | null } | null>
```

- **One token per user** — enforced by `UNIQUE(user_id)` in the schema
- **Regenerate = revoke old + create new** — old URL stops working immediately
- Token: `crypto.randomBytes(32).toString("hex")` → 64 hex characters (256 bits of entropy)
- Soft-deleted users (`deletedAt IS NOT NULL`) are rejected even if the token is valid

### Token Storage Schema

```typescript
// src/db/schema.ts
export const calendarTokens = pgTable("calendar_tokens", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" })
		.unique(),
	token: varchar("token", { length: 64 }).notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- `onDelete: "cascade"` — deleting a user automatically removes their token
- Both `userId` and `token` have column-level `.unique()` constraints

### Token Management UI

The settings page (`app/routes/settings.tsx`) handles token creation and regeneration:
- `intent: "generate-calendar-token"` — first-time creation, shows the feed URL
- `intent: "regenerate-calendar-token"` — replaces existing token (old URL stops working)
- The feed URL is displayed for copy-paste: `{APP_URL}/api/calendar/{token}.ics`

**Important:** Token generation happens in an `action` (POST), never in a `loader` (GET). Creating credentials in a GET request is a security anti-pattern (URL referer leakage, browser prefetch, etc.).

## Feed Route (`api.calendar.$token.ics.tsx`)

A Remix **resource route** (loader only, no component). Responds with `text/calendar`:

```typescript
export async function loader({ params }: LoaderFunctionArgs) {
	const token = params.token;
	if (!token) throw new Response("Not Found", { status: 404 });

	const user = await getUserByCalendarToken(token);
	if (!user) throw new Response("Not Found", { status: 404 });

	const events = await getUserCalendarEvents(user.id);
	// ... map to CalendarEvent objects ...
	const icsContent = generateCalendarFeed(calendarEvents);

	return new Response(icsContent, {
		status: 200,
		headers: {
			"Content-Type": "text/calendar; charset=utf-8",
			"Cache-Control": "private, no-store",
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
}
```

### Security Headers

| Header | Value | Why |
|--------|-------|-----|
| `Content-Type` | `text/calendar; charset=utf-8` | Proper MIME type for iCal feeds |
| `Cache-Control` | `private, no-store` | Prevents caching by CDNs/proxies — token in URL is sensitive |
| `X-Robots-Tag` | `noindex, nofollow` | Prevents search engine indexing of feed URLs |
| `Content-Disposition` | **Not set** | Intentionally omitted — setting it would trigger a download instead of a subscription |

### Event Query — Bounded Time Range

`getUserCalendarEvents()` in `app/services/events.server.ts` limits the query window:

```typescript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const sixMonthsOut = new Date();
sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
```

This is important: without bounds, the query would scan ALL events for the user across ALL groups across ALL time — a performance disaster for active users.

## Common Pitfalls

### 1. Double-Escaped Newlines

When building `DESCRIPTION`, the group name and description are joined with `\n`:

```typescript
descParts.join("\n")  // literal newline
```

Then `escapeICalText()` converts `\n` to the iCal `\n` escape. If you pre-escape the newline (e.g., using `\\n` in the join), you'll get `\\n` in the output — which renders as a literal backslash-n instead of a line break.

**Test for this:**
```typescript
expect(feed).toContain("Group: Team Alpha\\nWeekly practice");
expect(feed).not.toContain("Group: Team Alpha\\\\nWeekly practice");
```

### 2. Unbounded Time Range

Always bound event queries. Calendar feeds are polled automatically (every 15 min to 24 hours depending on the client). An unbounded query on every poll would hammer the database.

### 3. Content-Disposition Breaks Subscriptions

Do NOT set `Content-Disposition: attachment`. Calendar apps need to GET the URL repeatedly — an attachment header causes a one-time download instead of a live subscription.

### 4. CRLF vs LF

Every test that checks iCal output should verify CRLF line endings:

```typescript
it("uses CRLF line endings", () => {
	const feed = generateCalendarFeed([baseEvent]);
	expect(feed).toContain("\r\n");
	const lines = feed.split("\r\n");
	for (const line of lines) {
		expect(line).not.toContain("\n");
	}
});
```

### 5. Folding Uses Character Count, Not Octet Count

RFC 5545 specifies 75 **octets**, but our `foldLine` uses JS string length. For ASCII content this is equivalent. If non-ASCII characters (emoji, accented names) appear in event titles or descriptions, multi-byte UTF-8 characters could push lines past 75 octets while appearing under 75 characters. Monitor this if internationalization is added.

## Testing iCal Output

### Unit Tests (`app/lib/ical-utils.test.ts`)

Test each function in isolation:
- `formatICalDate` — midnight, end-of-day, typical times
- `escapeICalText` — each special character individually, then combined
- `foldLine` — short lines unchanged, exactly 75 chars unchanged, long lines fold with CRLF + space
- `generateCalendarFeed` — VCALENDAR structure, VEVENT count, UID format, optional properties omitted when null, performer callTime logic, CRLF line endings, double-escape prevention

### Route Tests (`app/routes/api.calendar.$token.ics.test.ts`)

Mock the service layer and test the route loader:

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
```

Test scenarios:
- Valid token → 200 with `text/calendar` content type
- Invalid/missing token → 404
- Security headers present (`Cache-Control`, `X-Robots-Tag`)
- `Content-Disposition` header is NOT set
- Events from multiple groups appear in feed
- Performer at show uses `callTime` for `DTSTART`
- Empty feed (no events) still has valid VCALENDAR wrapper

### Key Testing Pattern: Unfold to Verify

Long property values get folded. To verify content in tests, either:
1. Use `toContain()` on the raw output (works for short values)
2. Unfold first: `feed.replace(/\r\n /g, "")` then check the unfolded string
