---
name: greenroom-architecture
description: GreenRoom application architecture, patterns, and conventions
---

# GreenRoom Architecture

## Remix Route Structure

GreenRoom uses Remix v2 flat file routing with Vite. Routes live in `app/routes/` and follow dot notation:

```
groups.$groupId.events.new.tsx  →  /groups/:groupId/events/new
groups.$groupId.tsx             →  Layout route (renders <Outlet />)
groups.$groupId._index.tsx      →  Index route for the layout
```

### Nested Layouts

`groups.$groupId.tsx` is a layout route providing tab navigation (Overview, Availability, Events, Settings). Child routes render inside its `<Outlet />`. The layout loader validates group membership and provides group/user/role data:

```typescript
// groups.$groupId.tsx
export async function loader({ request, params }: LoaderFunctionArgs) {
  const groupId = params.groupId ?? "";
  const user = await requireGroupMember(request, groupId);
  const group = await getGroupById(groupId);
  if (!group) throw new Response("Not Found", { status: 404 });
  const role = await getUserRole(user.id, groupId);
  return { group, user, role };
}
```

Child routes access parent data via:

```typescript
const parentData = useRouteLoaderData<typeof groupLayoutLoader>("routes/groups.$groupId");
const role = parentData?.role;
const group = parentData?.group;
```

### Loader/Action Pattern

Every route follows this structure:

```typescript
// Loader: read data
export async function loader({ request, params }: LoaderFunctionArgs) {
  const groupId = params.groupId ?? "";
  const user = await requireGroupMember(request, groupId); // auth check
  const data = await getGroupEvents(groupId);              // service call
  return { events: data, userId: user.id };
}

// Action: write data (uses intent for multi-action routes)
export async function action({ request, params }: ActionFunctionArgs) {
  const groupId = params.groupId ?? "";
  const user = await requireGroupAdmin(request, groupId);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteEvent(eventId);
    return redirect(`/groups/${groupId}/events`);
  }
  // ... more intents
}
```

## Service Layer Pattern

All business logic lives in `app/services/*.server.ts`. The `.server.ts` suffix ensures Remix excludes these from the client bundle. Services import `db` from `src/db/index.ts` and schema from `src/db/schema.ts`.

### Auth Service (`auth.server.ts`)

```typescript
// Core auth functions
export async function requireUser(request: Request): Promise<AuthUser>
export async function requireGroupMember(request: Request, groupId: string): Promise<AuthUser>  // in groups.server.ts
export async function requireGroupAdmin(request: Request, groupId: string): Promise<AuthUser>   // in groups.server.ts
export async function getOptionalUser(request: Request): Promise<AuthUser | null>

// Registration
export async function registerUser(email: string, password: string, name: string): Promise<AuthUser>

// Google OAuth
export function getGoogleAuthURL(): string
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile>
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<AuthUser>
```

### Groups Service (`groups.server.ts`)

```typescript
export async function createGroup(userId: string, data: { name: string; description?: string }): Promise<Group>
export async function getUserGroups(userId: string): Promise<Array<Group & { role: string; memberCount: number }>>
export async function getGroupById(groupId: string): Promise<Group | null>
export async function getGroupWithMembers(groupId: string): Promise<{ group: Group; members: Member[] } | null>
export async function joinGroup(userId: string, inviteCode: string): Promise<{ success: boolean; groupId?: string; error?: string }>
export async function isGroupMember(userId: string, groupId: string): Promise<boolean>
export async function isGroupAdmin(userId: string, groupId: string): Promise<boolean>
export async function updateGroup(groupId: string, data: Partial<Group>): Promise<Group>
export async function regenerateInviteCode(groupId: string): Promise<string>
export async function removeMember(groupId: string, userId: string): Promise<void>
```

### Availability Service (`availability.server.ts`)

```typescript
export async function createAvailabilityRequest(data: CreateRequestInput): Promise<AvailabilityRequest>
export async function getGroupAvailabilityRequests(groupId: string): Promise<RequestWithCounts[]>
export async function getAvailabilityRequest(requestId: string): Promise<RequestWithCreator | null>
export async function submitAvailabilityResponse(data: { requestId: string; userId: string; responses: Record<string, Status> }): Promise<void>
export async function getUserResponse(requestId: string, userId: string): Promise<Record<string, string> | null>
export async function getAggregatedResults(requestId: string): Promise<AggregatedResults>
export async function closeAvailabilityRequest(requestId: string): Promise<void>
export async function reopenAvailabilityRequest(requestId: string): Promise<void>
```

### Events Service (`events.server.ts`)

```typescript
export async function createEvent(data: CreateEventInput): Promise<Event>
export async function createEventsFromAvailability(data: BulkCreateInput): Promise<Event[]>
export async function getGroupEvents(groupId: string, options?: { upcoming?: boolean; eventType?: string }): Promise<EventWithCounts[]>
export async function getEventWithAssignments(eventId: string): Promise<{ event: Event; assignments: Assignment[] } | null>
export async function updateEvent(eventId: string, data: Partial<Event>): Promise<Event>
export async function deleteEvent(eventId: string): Promise<void>
export async function assignToEvent(eventId: string, userId: string, role?: string): Promise<void>
export async function bulkAssignToEvent(eventId: string, userIds: string[], role?: string): Promise<void>
export async function updateAssignmentStatus(eventId: string, userId: string, status: "confirmed" | "declined"): Promise<void>
```

### Email Service (`email.server.ts`)

```typescript
// Low-level sender (graceful fallback if Azure not configured)
export async function sendEmail(options: { to: string | string[]; subject: string; html: string; text?: string }): Promise<{ success: boolean; error?: string }>

// High-level notification senders (all fire-and-forget via void prefix)
export async function sendAvailabilityRequestNotification(options: NotificationOptions): Promise<void>
export async function sendEventCreatedNotification(options: EventNotificationOptions): Promise<void>
export async function sendEventAssignmentNotification(options: AssignmentNotificationOptions): Promise<void>
```

## Drizzle ORM Query Patterns

### Basic Select with Filter

```typescript
const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
```

### Inner Join with Selected Columns

```typescript
const members = await db
  .select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: groupMemberships.role,
    joinedAt: groupMemberships.joinedAt,
  })
  .from(groupMemberships)
  .innerJoin(users, eq(groupMemberships.userId, users.id))
  .where(eq(groupMemberships.groupId, groupId))
  .orderBy(groupMemberships.role, users.name);
```

### Correlated Subquery for Counts

```typescript
const rows = await db
  .select({
    id: events.id,
    title: events.title,
    assignmentCount: sql<number>`cast((
      select count(*) from event_assignments
      where event_assignments.event_id = ${events.id}
    ) as int)`,
  })
  .from(events)
  .where(eq(events.groupId, groupId));
```

### Upsert (Insert on Conflict Update)

```typescript
await db
  .insert(availabilityResponses)
  .values({ requestId, userId, responses, respondedAt: now, updatedAt: now })
  .onConflictDoUpdate({
    target: [availabilityResponses.requestId, availabilityResponses.userId],
    set: { responses, updatedAt: now },
  });
```

### Insert with onConflictDoNothing

```typescript
await db
  .insert(eventAssignments)
  .values(userIds.map((userId) => ({ eventId, userId, role: role ?? null, status: "pending" as const })))
  .onConflictDoNothing();
```

### Transaction

```typescript
const result = await db.transaction(async (tx) => {
  const [group] = await tx.insert(groups).values({ ... }).returning();
  await tx.insert(groupMemberships).values({ groupId: group.id, userId, role: "admin" });
  return group;
});
```

### Window Function

```typescript
memberCount: sql<number>`cast(count(*) over (partition by ${groups.id}) as int)`,
```

## Component Architecture

Components in `app/components/` are presentational — they receive data via props and don't make API calls.

### AvailabilityGrid

Interactive date × status grid. Used in the availability request response page.

```tsx
<AvailabilityGrid
  dates={["2025-03-15", "2025-03-16"]}
  responses={{ "2025-03-15": "available" }}
  onChange={(responses) => setResponses(responses)}
  disabled={isClosed}
/>
```

### DateSelector

Calendar-based multi-date picker. Used when creating availability requests.

```tsx
<DateSelector
  startDate="2025-03-01"
  endDate="2025-03-31"
  selectedDates={selectedDates}
  onChange={setSelectedDates}
/>
```

### EventCard

Reusable event card used across dashboard, event lists, and group overview sidebar.

```tsx
<EventCard
  id={event.id}
  groupId={event.groupId}
  title={event.title}
  eventType={event.eventType}
  startTime={event.startTime}
  endTime={event.endTime}
  location={event.location}
  assignmentCount={event.assignmentCount}
  confirmedCount={event.confirmedCount}
  userStatus={event.userStatus}
  groupName={event.groupName}
  compact  // optional: hides assignment counts footer
/>
```

### EventCalendar

Monthly calendar with colored dots for events. Supports navigation and date click callbacks.

```tsx
<EventCalendar
  events={events.map((e) => ({ id: e.id, title: e.title, eventType: e.eventType, startTime: e.startTime }))}
  onDateClick={(date) => setCalendarSelectedDate(date)}
/>
```

### ResultsHeatmap

Admin view of aggregated availability results. Shows per-date scores with expandable respondent details.

```tsx
<ResultsHeatmap
  dates={results.dates}
  totalMembers={results.totalMembers}
  totalResponded={results.totalResponded}
  groupId={groupId}
  requestId={requestId}
/>
```

## UI Styling Conventions

- **Color palette:** Emerald (primary), Slate (neutral), Amber (warning), Rose/Red (error/danger), Purple (shows)
- **Spacing:** Consistent `rounded-xl` for cards, `rounded-lg` for inputs/buttons
- **Icons:** `lucide-react` — import individual icons
- **Utility:** `cn()` from `src/lib/utils.ts` for conditional class merging
- **Responsive:** Mobile-first with `sm:`, `lg:` breakpoints. Many components have separate mobile/desktop layouts
- **Loading states:** Global `LoadingBar` in root, `isSubmitting` pattern from `useNavigation()` for buttons
- **Error display:** Red bordered alert boxes with `border-red-200 bg-red-50 text-red-700`
- **Success display:** Emerald bordered alert boxes with `border-emerald-200 bg-emerald-50 text-emerald-700`
