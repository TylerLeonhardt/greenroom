---
name: feature-builder
description: Specialized agent for building new My Call Time features
---

# My Call Time Feature Builder

You build new features for My Call Time, an improv group scheduling platform. Follow these patterns exactly to match the existing codebase.

## Step-by-Step Workflow

### 1. Schema (if needed)

Add tables in `src/db/schema.ts`:

```typescript
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const newTable = pgTable(
  "new_table",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    createdById: uuid("created_by_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("new_table_group_id_idx").on(table.groupId)],
);
```

Then generate and run the migration:

```bash
pnpm run db:generate
pnpm run db:migrate
```

### 2. Service Layer

Create `app/services/{feature}.server.ts`. The `.server.ts` suffix is mandatory — Remix strips these from the client bundle.

```typescript
import { eq } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import { newTable } from "../../src/db/schema.js";

type NewRecord = typeof newTable.$inferSelect;

export async function createRecord(data: {
  groupId: string;
  title: string;
  description?: string;
  createdById: string;
}): Promise<NewRecord> {
  const [record] = await db
    .insert(newTable)
    .values({
      groupId: data.groupId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      createdById: data.createdById,
    })
    .returning();
  if (!record) throw new Error("Failed to create record.");
  return record;
}
```

Important import paths:
- DB: `import { db } from "../../src/db/index.js"` (relative, with `.js` extension)
- Schema: `import { table } from "../../src/db/schema.js"`
- Auth: `import { requireUser } from "./auth.server.js"`
- Other services: `import { fn } from "./other.server.js"`

### 3. Route

Create `app/routes/{path}.tsx`:

```typescript
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { requireGroupMember } from "~/services/groups.server";
import { getRecords } from "~/services/feature.server";

export const meta: MetaFunction = () => {
  return [{ title: "Feature — My Call Time" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const groupId = params.groupId ?? "";
  const user = await requireGroupMember(request, groupId);
  const records = await getRecords(groupId);
  return { records, userId: user.id };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const groupId = params.groupId ?? "";
  const user = await requireGroupAdmin(request, groupId);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const title = formData.get("title");
    if (typeof title !== "string" || !title.trim()) {
      return { error: "Title is required." };
    }
    // ... create record
    return { success: true };
  }

  return { error: "Invalid action." };
}

export default function FeaturePage() {
  const { records } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div>
      {/* Error banner */}
      {actionData && "error" in actionData && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionData.error}
        </div>
      )}

      {/* Success banner */}
      {actionData && "success" in actionData && actionData.success && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Done!
        </div>
      )}

      {/* Form */}
      <Form method="post">
        <input type="hidden" name="intent" value="create" />
        {/* form fields */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Create"}
        </button>
      </Form>
    </div>
  );
}
```

### 4. Access Parent Layout Data (for group routes)

```typescript
import type { loader as groupLayoutLoader } from "./groups.$groupId";
const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
const role = parentData?.role;
const group = parentData?.group;
```

## Code Conventions

### File Naming

- Routes: `app/routes/groups.$groupId.feature.tsx`
- Services: `app/services/feature.server.ts`
- Components: `app/components/feature-name.tsx`

### Input Validation in Actions

Always validate all input from `formData`:

```typescript
const title = formData.get("title");
if (typeof title !== "string" || !title.trim()) {
  return { error: "Title is required." };
}
```

### Auth Patterns

- **Read-only page for members:** `requireGroupMember(request, groupId)`
- **Write actions for admins:** `requireGroupAdmin(request, groupId)`
- **Inline admin check:** `const admin = await isGroupAdmin(user.id, groupId);`
- **Root-level pages:** `requireUser(request)`

### UI Styling Patterns

**Card container:**
```tsx
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
```

**Section heading:**
```tsx
<h2 className="text-2xl font-bold text-slate-900">Title</h2>
<p className="mt-1 text-sm text-slate-600">Description</p>
```

**Form input:**
```tsx
<input
  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
/>
```

**Primary button:**
```tsx
<button className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
```

**Secondary button:**
```tsx
<button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
```

**Badge (admin):**
```tsx
<span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Admin</span>
```

**Empty state:**
```tsx
<div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
  <Icon className="mx-auto h-12 w-12 text-slate-300" />
  <h3 className="mt-4 text-sm font-medium text-slate-900">Nothing here yet</h3>
  <p className="mt-1 text-sm text-slate-500">Description</p>
</div>
```

### Color Palette

- **Primary/Success:** `emerald-600` (buttons, active tabs, links)
- **Neutral:** `slate-*` (text, borders, backgrounds)
- **Warning:** `amber-*` (pending states, action required)
- **Danger:** `red-*` / `rose-*` (errors, delete actions)
- **Show events:** `purple-*`
- **Rehearsal events:** `emerald-*`

### Icons

Always use `lucide-react`:

```tsx
import { Calendar, Check, Plus, Users, X } from "lucide-react";
```

## Quality Checklist

Before committing:

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run build` passes
- [ ] Every loader/action has proper auth checks (`requireUser`, `requireGroupMember`, or `requireGroupAdmin`)
- [ ] Group-scoped data always filters by `groupId`
- [ ] Cross-resource access validates ownership (e.g., `resource.groupId === params.groupId`)
- [ ] Form actions validate all inputs (check for `typeof x !== "string"` and empty strings)
- [ ] Error and success states display correctly in the UI
- [ ] Loading states use `useNavigation().state === "submitting"` for button disabling
- [ ] New routes have `meta` function returning a `{ title }` with "— My Call Time" suffix
- [ ] Redirects after successful mutations (POST-redirect-GET pattern)
