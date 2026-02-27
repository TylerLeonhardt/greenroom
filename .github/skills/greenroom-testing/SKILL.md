---
name: greenroom-testing
description: Testing patterns, Vitest configuration, and how to test GreenRoom code
---

# GreenRoom Testing Guide

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
- Edge cases: empty groups, no responses, expired requests

**Lower priority (integration tests):**
- Full loader → service → DB flow (requires test database)
- Component rendering (needs jsdom environment)
