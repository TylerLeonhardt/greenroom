---
name: availability-cast-selection
description: How availability requests relate to events and how the Add Members panel groups members by response status (available, maybe, not_available, no_response)
---

# Availability → Cast Selection Pattern

This skill documents how availability data flows into the event detail page's **Add Members** panel, where admins assign cast or attendees.

## Availability ↔ Event Relationship

Events can optionally link back to the availability request they were created from via `events.createdFromRequestId` (nullable FK → `availability_requests.id`).

When an admin creates an event from the availability results page, the route passes `?fromRequest=<requestId>&date=<selectedDate>` to the event creation form. The created event stores `createdFromRequestId` so the event detail page can look up who was available.

```
availability_requests  ←──  events.createdFromRequestId
         │
         └── availability_responses (one per user per request)
                 └── responses JSONB: { "2025-03-15": "available", "2025-03-16": "maybe" }
```

## How `getAvailabilityForEventDate()` Works

Located in `app/services/events.server.ts`. Called from the event detail loader when:
1. The current user is a group admin
2. The event has a `createdFromRequestId`
3. The availability request belongs to the same group (IDOR check)

```typescript
async function getAvailabilityForEventDate(
  requestId: string,
  date: string,
): Promise<Array<{ userId: string; userName: string; status: string }>>
```

- Joins `availability_responses` with `users` for the given request
- Extracts the status for the specific `date` key from the JSONB `responses` column
- Returns only members who **submitted a response** (even if their status for that date is missing — those get `"no_response"`)
- Members who **never submitted any response at all** are NOT included in the result

The `date` key is derived from the event's `startTime` converted to the user's timezone via `utcToLocalParts()`.

## The Four Member Groups

In the event detail component (`groups.$groupId.events.$eventId.tsx`), unassigned members are categorized into four groups when availability data exists:

| Group | Filter | Color | Emoji |
|-------|--------|-------|-------|
| **Available** | `status === "available"` and not assigned | `emerald` | ✅ |
| **Maybe** | `status === "maybe"` and not assigned | `amber` | 🤔 |
| **Not Available** | `status === "not_available"` and not assigned | `red` (dimmed) | ❌ |
| **No Response** | Not in `availabilityData` at all and not assigned | `slate` | ❓ |

The "No Response" group is computed client-side:

```typescript
const respondedUserIds = new Set(availabilityData.map((a) => a.userId));
const noResponseUsers = unassignedMembers
  .filter((m) => !respondedUserIds.has(m.id))
  .map((m) => ({ userId: m.id, userName: m.name }));
```

### Fallback: No Availability Data

When `hasAvailData === false` (i.e., the event was NOT created from an availability request, or the request belongs to another group), the grouped view is hidden and a flat member list renders instead:
- Show events → "Select Performers" (purple chips)
- Non-show events → "Select Members" (emerald chips)

## Dual-Panel Pattern: Show vs Non-Show Events

The Add Members panel renders differently based on `event.eventType`:

### Show Events (`eventType === "show"`)
- Panel header: "Add Performers"
- Hidden input: `<input name="role" value="Performer" />`
- Submit button: "Add N Performer(s)"
- Fallback label: "Select Performers" (purple chips)

### Non-Show Events (`eventType !== "show"`)
- Panel header: "Add Members"
- Role selector dropdown (Performer/Viewer/custom)
- Hidden input: `<input name="role" value={assignRole} />`
- Submit button: "Add N Member(s)"
- Fallback label: "Select Members" (emerald chips)

Both panels share the same availability grouping logic (available/maybe/not_available/no_response) and the same `UserChipSelector` component.

## `UserChipSelector` Component

Located in `app/components/user-chip-selector.tsx`. A toggleable chip grid for selecting users.

```typescript
interface Props {
  users: Array<{ id: string; name: string }>;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  colorScheme: "emerald" | "amber" | "red" | "purple" | "slate";
  dimmed?: boolean;  // reduces opacity (used for "Not Available")
}
```

### Color Scheme Mapping

| Scheme | Selected Style | Use Case |
|--------|---------------|----------|
| `emerald` | Green border/bg | Available members, generic member list |
| `amber` | Amber border/bg | Maybe members |
| `red` | Red border/bg | Not Available members |
| `purple` | Purple border/bg | Fallback performer list (no availability data) |
| `slate` | Slate border/bg | No Response members |

## Loader Data Contract

The event detail loader returns these fields relevant to cast selection:

```typescript
return {
  members,          // All group members (only populated for admins)
  availabilityData, // Array<{ userId, userName, status }> — only responders
  assignments,      // Current event assignments
  isAdmin,          // Whether current user is a group admin
  // ... other fields
};
```

The component computes derived state:
- `assignedUserIds` — members already on the cast list
- `unassignedMembers` — `members` minus `assignedUserIds`
- `availableUsers`, `maybeUsers`, `unavailableUsers` — from `availabilityData`, excluding assigned
- `noResponseUsers` — `unassignedMembers` not in `availabilityData`
- `hasAvailData` — whether to show grouped view vs flat fallback

## Key Files

| File | Role |
|------|------|
| `app/routes/groups.$groupId.events.$eventId.tsx` | Event detail route (loader + component) |
| `app/services/events.server.ts` | `getAvailabilityForEventDate()`, `getAvailabilityRequestGroupId()` |
| `app/components/user-chip-selector.tsx` | `UserChipSelector` chip grid component |
| `app/routes/groups.$groupId.events.$eventId.test.ts` | Loader + action tests |
