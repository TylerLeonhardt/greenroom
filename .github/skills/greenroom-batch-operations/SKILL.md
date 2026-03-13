# Batch Operations & Multi-Step Form Patterns

## Overview

Patterns for building batch operations in the greenroom codebase — multi-select UIs, batch creation with consolidated notifications, and multi-step form flows.

## Batch Event Creation (Reference Implementation)

The availability heatmap batch event creation is the canonical example.

### Route Structure

```
groups.$groupId.availability.$requestId_.batch.tsx
                                        ^ trailing underscore = "pathless layout escape"
```

**Critical routing detail:** The trailing underscore on `$requestId_` opts out of nesting inside `$requestId.tsx` (which has no `<Outlet/>`). The batch page renders inside `groups.$groupId.availability.tsx` (the layout wrapper), not inside the request detail page. Same pattern as `settings_.delete-account.tsx`.

### Multi-Select Heatmap Pattern

The `ResultsHeatmap` component supports optional batch mode via props:

```typescript
interface ResultsHeatmapProps {
  // ... existing props ...
  batchMode?: boolean;      // enables batch selection UI (admin-only)
  onBatchCreate?: (dates: string[]) => void;  // callback with selected dates
}
```

**Key behaviors:**
- Batch mode is a toggle — users explicitly enter selection mode
- When selecting: checkboxes replace expand/collapse, rows get selection styling
- "Select Top N" leverages existing score data for smart defaults
- Selected dates passed to batch route via query param: `?dates=2025-03-15,2025-03-22`
- Floating action bar on mobile for touch-friendly batch creation

### Two-Step Form Flow

The batch route uses client-side step management (`useState<"configure" | "review">`):

1. **Configure:** Shared fields (title, type, time, timezone) + per-item fields (locations per date)
2. **Review:** Summary banner + numbered cards showing all items. Submit form uses hidden inputs.

**Pattern for per-item variation in batch operations:**
```tsx
// "Apply to All" helper for the common case
<input placeholder="Same value for all" onChange={setApplyAll} />
<button onClick={() => items.forEach(i => set(i, applyAllValue))}>Apply to All</button>

// Per-item override for when values differ
{items.map(item => (
  <input key={item.id} name={`field-${item.id}`} value={values[item.id]} />
))}
```

### Consolidated Notifications

When performing batch operations that would normally trigger per-item notifications:

1. **Collect all items first** — create all events, then notify once
2. **Segment recipients by "best status"** across all items in the batch
3. **One email per member** listing all items, not one email per item
4. **One webhook message** listing the full batch

### Notification Segmentation for Batch

When members have different statuses per item (e.g., available for date A, maybe for date B):

```typescript
// Build "best status" per member across all batch items
const memberBestStatus = new Map<string, string>();
for (const item of batchItems) {
  const data = await getDataForItem(item);
  for (const entry of data) {
    const current = memberBestStatus.get(entry.userId);
    if (entry.status === "available") {
      memberBestStatus.set(entry.userId, "available");  // available wins
    } else if (entry.status === "maybe" && current !== "available") {
      memberBestStatus.set(entry.userId, "maybe");  // maybe beats no_response
    } else if (!current) {
      memberBestStatus.set(entry.userId, entry.status);  // first status seen
    }
  }
}
```

**Important edge case:** Users who responded to the parent request but didn't mark any of the batch-specific items should be routed to `noResponseRecipients`, NOT silently skipped. The segmentation must explicitly handle the "no_response" fallthrough.

## Testing Batch Operations

### What to test

| Layer | Tests |
|-------|-------|
| Service | Per-item field support (locations), shared field passthrough (description), fallback behavior |
| Email | Segmentation correctness, preference filtering, empty segment arrays, singular/plural grammar |
| Webhook | Embed formatting, schedule list formatting, location handling |
| Route action | Auth, CSRF, all validation rules, IDOR prevention, redirect with success params |

### Key gotchas

- **Notification segmentation bugs** — trace through edge cases where members have mixed statuses across batch items
- **URL length limits** — passing many dates via query params can hit limits; consider POST for very large batches
- **Remix routing** — `$param.child.tsx` nests inside `$param.tsx`; use `$param_.child.tsx` for independent pages

## Files

| File | Purpose |
|------|---------|
| `app/routes/groups.$groupId.availability.$requestId_.batch.tsx` | Batch creation route (loader, action, component) |
| `app/components/results-heatmap.tsx` | Heatmap with batch selection mode |
| `app/services/events.server.ts` | `createEventsFromAvailability()` — batch creation service |
| `app/services/email.server.ts` | `sendBatchEventsFromAvailabilityNotification()` |
| `app/services/webhook.server.ts` | `sendBatchEventsCreatedWebhook()` |
