---
name: greenroom-testing
description: Testing patterns, Vitest configuration, and how to test My Call Time code
---

# My Call Time Testing Guide

## Vitest Configuration

```typescript
// vitest.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,            // describe, it, expect available globally
    include: ["**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "~": new URL("./app", import.meta.url).pathname,
    },
  },
});
```

**Run tests:**
- `pnpm test` — single run
- `pnpm test:watch` — watch mode

## Testing Remix Loaders and Actions

Remix loaders and actions are plain async functions that take `Request` objects and return data or `Response` objects.

### Testing a Loader

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock the service modules before importing the route
vi.mock("~/services/auth.server", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com", name: "Test User", profileImage: null }),
}));

vi.mock("~/services/groups.server", () => ({
  getUserGroups: vi.fn().mockResolvedValue([
    { id: "group-1", name: "Test Group", role: "admin", memberCount: 3 },
  ]),
}));

import { loader } from "~/routes/groups";

describe("groups loader", () => {
  it("returns user groups", async () => {
    const request = new Request("http://localhost/groups");
    const response = await loader({
      request,
      params: {},
      context: {},
    });

    expect(response).toEqual({
      groups: [{ id: "group-1", name: "Test Group", role: "admin", memberCount: 3 }],
    });
  });
});
```

### Testing an Action

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("~/services/auth.server", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com", name: "Test User", profileImage: null }),
}));

vi.mock("~/services/groups.server", () => ({
  requireGroupAdmin: vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com", name: "Test User", profileImage: null }),
  updateGroup: vi.fn().mockResolvedValue({ id: "group-1", name: "Updated" }),
}));

import { action } from "~/routes/groups.$groupId.settings";
import { updateGroup } from "~/services/groups.server";

describe("group settings action", () => {
  it("updates group name", async () => {
    const formData = new FormData();
    formData.set("intent", "update");
    formData.set("name", "New Name");
    formData.set("description", "New description");

    const request = new Request("http://localhost/groups/group-1/settings", {
      method: "POST",
      body: formData,
    });

    const result = await action({
      request,
      params: { groupId: "group-1" },
      context: {},
    });

    expect(updateGroup).toHaveBeenCalledWith("group-1", {
      name: "New Name",
      description: "New description",
    });
    expect(result).toEqual({ success: true, message: "Group updated successfully." });
  });

  it("returns error for empty name", async () => {
    const formData = new FormData();
    formData.set("intent", "update");
    formData.set("name", "");

    const request = new Request("http://localhost/groups/group-1/settings", {
      method: "POST",
      body: formData,
    });

    const result = await action({
      request,
      params: { groupId: "group-1" },
      context: {},
    });

    expect(result).toEqual({ error: "Group name is required.", success: false });
  });
});
```

### Testing Actions with Redirects

Actions that redirect throw a `Response` object:

```typescript
it("redirects after creating group", async () => {
  const formData = new FormData();
  formData.set("name", "My Group");

  const request = new Request("http://localhost/groups/new", {
    method: "POST",
    body: formData,
  });

  try {
    await action({ request, params: {}, context: {} });
    expect.fail("Should have thrown a redirect");
  } catch (response) {
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toMatch(/^\/groups\//);
  }
});
```

## Mocking the Database Layer

Service functions use `db` from `src/db/index.ts`. Mock at the service level, not the DB level:

```typescript
// ✅ Good: Mock the service function
vi.mock("~/services/groups.server", () => ({
  createGroup: vi.fn().mockResolvedValue({ id: "new-group", name: "Test" }),
}));

// ❌ Bad: Don't mock the DB directly (too coupled to implementation)
vi.mock("../../src/db/index.js", () => ({ ... }));
```

## Testing Service Functions

For unit-testing service functions that talk to the DB, mock `drizzle-orm` operations or test against a real test database.

### Testing with Mock DB

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("../../src/db/index.js", () => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockFrom = vi.fn().mockReturnThis();
  const mockWhere = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockResolvedValue([{ id: "user-1", email: "test@example.com" }]);

  return {
    db: {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
    },
  };
});
```

### Testing Pure Functions in Services

Some service functions are pure and don't need DB mocks:

```typescript
import { describe, it, expect } from "vitest";
import { generateInviteCode } from "~/services/groups.server";

describe("generateInviteCode", () => {
  it("generates 8-character codes", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
  });

  it("only uses non-ambiguous characters", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});
```

## Testing Auth-Protected Routes

Auth functions throw redirects when the user is not authenticated:

```typescript
describe("protected route", () => {
  it("redirects to login if not authenticated", async () => {
    vi.mock("~/services/auth.server", () => ({
      requireUser: vi.fn().mockRejectedValue(
        new Response(null, { status: 302, headers: { Location: "/login" } })
      ),
    }));

    const request = new Request("http://localhost/dashboard");
    try {
      await loader({ request, params: {}, context: {} });
      expect.fail("Should redirect");
    } catch (response) {
      expect((response as Response).headers.get("Location")).toBe("/login");
    }
  });

  it("returns 404 for non-members", async () => {
    vi.mock("~/services/groups.server", () => ({
      requireGroupMember: vi.fn().mockRejectedValue(
        new Response("Not Found", { status: 404 })
      ),
    }));

    const request = new Request("http://localhost/groups/some-id");
    try {
      await loader({ request, params: { groupId: "some-id" }, context: {} });
      expect.fail("Should throw 404");
    } catch (response) {
      expect((response as Response).status).toBe(404);
    }
  });
});
```

## Test File Structure

```
app/
├── services/
│   ├── groups.server.ts
│   └── groups.server.test.ts    # Co-located test files
├── routes/
│   ├── dashboard.tsx
│   └── dashboard.test.ts
└── components/
    ├── event-card.tsx
    └── event-card.test.tsx
```

### Example Test File Template

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("~/services/auth.server", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    profileImage: null,
  }),
}));

// Import module under test AFTER vi.mock calls
import { loader, action } from "~/routes/some-route";

describe("route-name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("returns expected data", async () => {
      const request = new Request("http://localhost/path");
      const result = await loader({ request, params: {}, context: {} });
      expect(result).toBeDefined();
    });
  });

  describe("action", () => {
    it("handles form submission", async () => {
      const formData = new FormData();
      formData.set("intent", "some-action");

      const request = new Request("http://localhost/path", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {} });
      expect(result).toBeDefined();
    });
  });
});
```

## What to Test

**High priority:**
- Auth guard functions work correctly (redirect unauthenticated, 404 non-members, 403 non-admins)
- Action validation logic (required fields, invalid input)
- Service function business logic (invite code generation, score calculation, date aggregation)
- Rate limiting behavior (allow/block thresholds, window expiry)
- Edge cases: empty groups, no responses, expired requests

**Lower priority (integration tests):**
- Full loader → service → DB flow (requires test database)
- Component rendering (needs jsdom environment)

---

## Environment Configuration

### `SESSION_SECRET` Requirement

The session service (`app/services/session.server.ts`) throws at module load time if `SESSION_SECRET` is not set. This means any test that imports a service file (even transitively) will crash without it.

Vitest handles this in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    env: {
      SESSION_SECRET: "test-secret-for-vitest",
    },
  },
});
```

If you add new environment variables that are validated at module load time, add them here too.

---

## Testing Rate Limiting

The rate limiter (`app/services/rate-limit.server.ts`) uses in-memory state. Use `_resetForTests()` to clear state between tests.

### Direct Service Tests

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { _resetForTests, checkRateLimit } from "~/services/rate-limit.server";

describe("rate limiting", () => {
  beforeEach(() => {
    _resetForTests(); // Clear all rate limit state
  });

  it("allows requests under the limit", () => {
    const result = checkRateLimit("test-key", 5, 60000);
    expect(result.limited).toBe(false);
  });

  it("blocks after exceeding limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-key", 5, 60000);
    }
    const result = checkRateLimit("test-key", 5, 60000);
    expect(result.limited).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("isolates keys", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("key-a", 5, 60000);
    }
    const result = checkRateLimit("key-b", 5, 60000);
    expect(result.limited).toBe(false);
  });
});
```

### Mocking Rate Limiting in Route Tests

When testing login/signup route actions, mock the rate limiter to control behavior:

```typescript
vi.mock("~/services/rate-limit.server", () => ({
  checkLoginRateLimit: vi.fn().mockReturnValue({ limited: false }),
}));

import { checkLoginRateLimit } from "~/services/rate-limit.server";

describe("login action", () => {
  beforeEach(() => {
    (checkLoginRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
  });

  it("returns 429 when rate limited", async () => {
    (checkLoginRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({
      limited: true,
      retryAfter: 45,
    });

    const formData = new FormData();
    formData.set("email", "test@example.com");
    formData.set("password", "password123");

    const request = new Request("http://localhost/login", {
      method: "POST",
      body: formData,
    });

    const result = await action({ request, params: {}, context: {} });
    expect(result).toEqual(
      expect.objectContaining({ error: expect.stringContaining("Too many") })
    );
  });
});
```

---

## Testing Email Service

The email service (`app/services/email.server.ts`) uses fire-and-forget patterns. Mock it at the service boundary:

### Mocking `sendEmail`

```typescript
vi.mock("~/services/email.server", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  sendAvailabilityRequestNotification: vi.fn().mockResolvedValue(undefined),
  sendEventCreatedNotification: vi.fn().mockResolvedValue(undefined),
  sendEventAssignmentNotification: vi.fn().mockResolvedValue(undefined),
}));

import { sendEmail } from "~/services/email.server";

it("sends notification after creating availability request", async () => {
  // ... perform action ...
  expect(sendAvailabilityRequestNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      requestTitle: "March Rehearsal",
      groupName: "Test Group",
    })
  );
});
```

### Testing Email Graceful Degradation

The email service never throws — it returns `{ success: boolean; error?: string }`. When `AZURE_COMMUNICATION_CONNECTION_STRING` is not set, it logs to console and returns `{ success: true }` (graceful no-op). You don't need to test this in route tests; it's handled by the service layer.

---

## E2E Testing with Playwright

My Call Time has the `playwright-cli` skill (`.github/skills/playwright-cli/`) for browser automation.

### Login Flow

```typescript
// Navigate to login page
await page.goto("http://localhost:5173/login");

// Fill in credentials
await page.fill('input[name="email"]', "test@example.com");
await page.fill('input[name="password"]', "password123");
await page.click('button[type="submit"]');

// Verify redirect to dashboard
await page.waitForURL("**/dashboard");
expect(page.url()).toContain("/dashboard");
```

### URL Structure for Navigation

```
/                                          → Landing page
/login                                     → Login form
/signup                                    → Registration form
/dashboard                                 → Authenticated dashboard
/groups                                    → Group list
/groups/new                                → Create group
/groups/<groupId>                          → Group overview
/groups/<groupId>/availability             → Availability requests
/groups/<groupId>/availability/new         → Create availability request
/groups/<groupId>/availability/<requestId> → View/respond to request
/groups/<groupId>/events                   → Events list
/groups/<groupId>/events/new               → Create event
/groups/<groupId>/events/<eventId>         → Event detail
/groups/<groupId>/settings                 → Group settings (admin)
```

### Test Data Setup

For E2E tests, seed the database with test data using the seed script or direct API calls:

```bash
# Run the demo seed script (creates test users and groups)
node seed-demo.mjs
```

Or create test data programmatically by:
1. POST to `/signup` to create a user
2. POST to `/login` to authenticate
3. POST to `/groups/new` to create a group
4. Use the returned group ID for further operations
