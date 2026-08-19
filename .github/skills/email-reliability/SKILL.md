---
name: email-reliability
description: Azure Communication Services email error patterns, the error classification taxonomy (suppressed/clock_skew/transient/permanent), retry logic, fire-and-forget vs checked-result architecture, and email telemetry. Read before touching app/services/email.server.ts or any flow that sends email.
---

# Email Reliability

How My Call Time sends email reliably through **Azure Communication Services (ACS)**, classifies failures, and decides when to retry. All email logic lives in `app/services/email.server.ts`.

## TL;DR

- Email is sent via the ACS `EmailClient.beginSend()` long-running operation.
- `sendEmail()` **never throws** — it returns `{ success, error?, errorKind? }`.
- Failures are classified into one of four kinds: `suppressed`, `clock_skew`, `transient`, `permanent`.
- **Transient** errors use exponential backoff. Shared-key clock skew gets one server-time-corrected
  retry in the HTTP transport; unrecoverable clock skew then fails fast.
- Most callers use **fire-and-forget** (`void sendXNotification(...)`). A few user-facing flows (signup/verification) **must check the result**.

## Error Classification Taxonomy

`classifyEmailError(error: unknown): EmailErrorKind` maps an error message to a kind. Order matters — it checks suppression first, then clock skew, then transient patterns, then defaults to permanent.

| Kind | What it means | Detection | Retry? |
|------|---------------|-----------|--------|
| `suppressed` | The recipient address is on Azure's suppression list (hard bounces, spam complaints, unsubscribes). Azure refuses to deliver. | `message.toLowerCase().includes("suppress")` — covers `Suppressed`, `suppression list`, `AllRecipientsSuppressed`, etc. | **No** — permanent for that address. Surface a user-facing "try a different email" message. |
| `clock_skew` | The host clock drifted past ACS's real 300-second margin, so request signing fails. | Message contains `"time difference between the originating client and the server is greater than the allowed margin"`. | **Once at the transport layer** — read Azure's response `Date`, compute local-to-server offset, re-sign, and retry. If the header is missing/invalid or the corrected retry fails, fail loudly. |
| `transient` | Temporary network/throughput failure. | Message contains `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `socket hang up`, `network`, `503`, or `429`. | **Yes** — retry with exponential backoff. |
| `permanent` | Anything else (bad payload, auth/config error, malformed address). | Default fall-through. | **No** — retrying won't help. |

### Why case-insensitive suppression matching

Azure surfaces suppression in several casings/wordings. Use `message.toLowerCase().includes("suppress")` rather than maintaining a list of exact substrings (which had redundant entries like `"AllRecipientsSuppressed"` already covered by `"suppressed"`).

## The Retry Loop

`sendEmail()` loops `attempt` from `0` to `MAX_RETRIES` (currently `2`, so up to **3 total attempts**):

```
for attempt in 0..MAX_RETRIES:
  try beginSend + pollUntilDone -> success, return { success: true }
  catch error:
    kind = classifyEmailError(error)
    if kind == "suppressed":  log warn + track "email.suppressed", return { success:false, errorKind:"suppressed" }
    if kind == "permanent":   break (fail fast)
    if kind == "clock_skew":  transport recovery already failed; log and break
    // transient only:
    if attempt < MAX_RETRIES: sleep(RETRY_BASE_DELAY_MS * 2**attempt) and retry
// after loop: log error, track EmailSent(success:false) + exception, return { success:false, errorKind }
```

- `RETRY_BASE_DELAY_MS = 1000`, so transient backoff is **1s then 2s**.
- Only `transient` errors fall through to this outer backoff/sleep. `suppressed`, unrecovered
  `clock_skew`, and `permanent` break (or return) immediately.
- Clock-skew recovery happens below this loop, where the raw Azure response `Date` header is
  available. It is capped at one corrected retry with bounded jitter.

## Clock-Skew Tolerance

ACS connection strings use shared-key HMAC authentication. The Azure SDK creates `x-ms-date`
from the host clock and includes it in the signature. `app/services/acs-email-auth.server.ts`
backdates that header by `EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS` and re-signs the final serialized
request at the HTTP transport boundary. The default is 60 seconds and the maximum is 120 seconds.
That fixed backdate only protects against a slightly fast host: it cannot repair multi-minute drift
and makes a slow clock worse.

On a real ACS `AuthenticationFailed` clock-skew response, the transport reads Azure's authoritative
`Date` response header, computes `server time - local time`, re-signs the already serialized request
with that offset, and retries once after bounded jitter. This handles arbitrary positive or negative
drift while preventing retry loops. A missing/invalid `Date` or a rejected corrected request is
logged as an error and returned to the normal failure path. Host NTP synchronization remains
recommended defense-in-depth.

The wrapper asserts that the SDK's shared-key credential policy already populated its HMAC headers
before re-signing. This fails loudly if an SDK upgrade changes policy ordering. It also requires the
Email SDK's serialized JSON string body so hashing cannot diverge between byte and `.toString()`
representations, and canonicalizes `host` from `URL.host` to avoid duplicated explicit ports.

Token-based ACS authentication would remove shared-key request signing entirely, but it is not
enabled in this change: the deployed Container App configuration does not define a managed identity
or the required ACS Email Sender RBAC assignment. Enabling it in application code first would replace
a working credential with one that cannot send. Shared-key remains the configured path until identity
and RBAC are provisioned together.

## Fire-and-Forget vs. Checked Result

The notification architecture is **fire-and-forget by default**: the user's request/response cycle must never block (or fail) because an email is slow or bounced.

```typescript
// Fire-and-forget — void prefix, no await. Used for group notifications,
// event reminders, availability requests, etc.
void sendAvailabilityRequestNotification({ ... });
```

**When fire-and-forget is correct:** notifications that are a side effect of a successful action (someone created a request, an event was scheduled, a reminder is due). The action already succeeded; email delivery is best-effort.

**When you MUST check the result:** flows where email delivery *is* the feature and the user is waiting on it — primarily **email verification / signup**. Here a silent failure would tell the user "check your email" when nothing was sent.

```typescript
const emailResult = await sendVerificationEmail({ ... });
if (!emailResult.success) {
  if (emailResult.errorKind === "suppressed") {
    return { error: "We couldn't deliver to this address. Try a different email." };
  }
  // permanent / clock_skew / transient
  return { error: "Something went wrong sending your verification email. Please try again or contact support." };
}
return { success: true };
```

> **Pitfall (fixed):** `app/routes/check-email.tsx` once only handled `errorKind === "suppressed"` and fell through to `{ success: true }` for every other failure — telling users an email was sent when it wasn't. Always handle **all** failure cases, not just suppression.

### "Not configured" is treated as success

If `AZURE_COMMUNICATION_CONNECTION_STRING` is unset (local dev), `sendEmail()` logs and returns `{ success: true }` without sending. This keeps local flows working. Tests that exercise the real retry loop must **set** the connection string and **mock the SDK** (see below).

## Telemetry

Email telemetry flows through `getTelemetryClient()` (Application Insights; null-safe no-op when not configured). Event/metric names use a dotted convention for failure kinds:

| Signal | When | Notes |
|--------|------|-------|
| `EmailSent` (custom event, `success: "true"`) | Successful send | Includes only `recipientCount`; recipient addresses and subjects are never recorded. |
| `EmailSent` (custom event, `success: "false"`) | After retries exhausted / fail-fast | Includes `recipientCount` and `errorKind` so you can pivot by failure type. |
| `email.suppressed` (custom event) | A suppression failure | Includes only `recipientCount`; recipient addresses are never recorded. |
| `trackException` | Final failure | Uses a sanitized error containing the failure kind, plus `recipientCount` and `errorKind`; raw provider errors are never recorded. |

Querying suppression rate in App Insights:

```kql
customEvents
| where name == "email.suppressed"
| where timestamp > ago(7d)
| summarize count() by tostring(customDimensions.recipientCount)
```

Querying failures by kind:

```kql
customEvents
| where name == "EmailSent" and tostring(customDimensions.success) == "false"
| summarize count() by tostring(customDimensions.errorKind)
```

## Testing the Retry Loop

The retry/backoff/error-kind logic only runs when ACS is configured, so tests must:

1. Mock `@azure/communication-email` so `EmailClient` returns a controllable `beginSend` mock. Use `vi.hoisted()` because `vi.mock` factories are hoisted above imports.
2. Set `AZURE_COMMUNICATION_CONNECTION_STRING` in `beforeEach`.
3. Reset the module between tests (`vi.resetModules()` + dynamic `import()`), because `email.server.ts` caches the `EmailClient` in a module-level singleton.
4. Use `vi.useFakeTimers()` + `await vi.runAllTimersAsync()` to fast-forward the backoff sleeps.

```typescript
const { beginSendMock } = vi.hoisted(() => ({ beginSendMock: vi.fn() }));
vi.mock("@azure/communication-email", () => ({
  EmailClient: vi.fn().mockImplementation(() => ({ beginSend: beginSendMock })),
}));

// transient-then-success:
beginSendMock
  .mockRejectedValueOnce(new Error("ECONNRESET"))
  .mockResolvedValueOnce({ pollUntilDone: vi.fn().mockResolvedValue(undefined) });
```

See `app/services/acs-email-auth.server.test.ts` for real `EmailClient` pipeline tests covering the
300-second ACS window, fast and slow seven-minute drift recovery, independent HMAC verification,
and the SDK-policy ordering guard. `app/services/email.server.test.ts` covers the outer retry loop.

## Key Files

- `app/services/email.server.ts` — `classifyEmailError`, `sendEmail`, all template senders.
- `app/services/email.server.test.ts` — classification + retry-loop tests.
- `app/services/telemetry.server.ts` — `getTelemetryClient()` (App Insights).
- `app/routes/check-email.tsx` — checked-result example (verification resend).
- `.github/skills/greenroom-notifications/` — per-group notification preferences and reminder cron (who gets emailed, and when).
