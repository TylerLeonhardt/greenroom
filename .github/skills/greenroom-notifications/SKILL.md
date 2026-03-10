# Greenroom Notifications & Reminder System

## Overview

My Call Time has a per-group notification preferences system and a cron-based event reminder system. Users control which emails they receive per group. The reminder system sends two types of timed emails before events.

## Notification Preferences

### Schema

Preferences are stored as JSONB on `group_memberships.notificationPreferences`. The type is defined in `src/db/schema.ts`:

```typescript
type NotificationChannelPreferences = { email: boolean };

type NotificationPreferences = {
  availabilityRequests: NotificationChannelPreferences;
  eventNotifications: NotificationChannelPreferences;
  showReminders: NotificationChannelPreferences;  // controls BOTH reminder types
};
```

**Defaults:** All channels enabled (`{ email: true }`) via `DEFAULT_NOTIFICATION_PREFERENCES`.

> **Note:** The key is `showReminders` (historical name). It controls reminders for ALL event types (rehearsals, shows, other), not just show-type events. The UI label was renamed to "Event reminders" to avoid confusion.

### Preference Flow

1. User navigates to `/groups/:groupId/notifications`
2. `getNotificationPreferences()` fetches from DB, merged with defaults via `mergeWithDefaults()`
3. Three checkboxes rendered (one per category)
4. On submit, `updateNotificationPreferences()` writes JSONB to `group_memberships`

### Key Files

| File | Purpose |
|------|---------|
| `app/routes/groups.$groupId.notifications.tsx` | UI page with checkboxes |
| `app/services/groups.server.ts` | `getNotificationPreferences()`, `updateNotificationPreferences()` |
| `app/services/notification-utils.server.ts` | `mergeWithDefaults()` — forward-compatible preference merging |
| `src/db/schema.ts` | `NotificationPreferences` type, `DEFAULT_NOTIFICATION_PREFERENCES` |

### Forward Compatibility

`mergeWithDefaults()` merges stored preferences with defaults category-by-category. If a new category is added to defaults, existing users automatically get the default value without a migration. This is critical for adding new notification types.

## Reminder System

### Architecture

- **Cron job** in `app/services/reminder.server.ts`
- Runs every **15 minutes** (`*/15 * * * *`)
- Enabled only when `ENABLE_REMINDERS=true` environment variable is set
- Uses **PostgreSQL advisory locks** (`pg_try_advisory_xact_lock`) to prevent duplicate sends across container replicas
- Started in `app/entry.server.tsx`

### Two Reminder Types

Both are controlled by the **same preference toggle** (`showReminders.email`).

#### 1. Confirmation Reminder — 48 hours before

| Aspect | Detail |
|--------|--------|
| **Function** | `processConfirmationReminders()` |
| **Timing** | Events starting 24–48 hours from now |
| **Recipients** | Attendees with `status = "pending"` (haven't confirmed/declined) |
| **Email function** | `sendConfirmationReminderNotification()` |
| **Subject** | `⏰ Please confirm: "{title}" in 2 days` |
| **CTA** | "Confirm Attendance" button |
| **Tracking column** | `events.confirmationReminderSentAt` |
| **Purpose** | Nudge unconfirmed attendees to respond |

#### 2. Event Reminder — 24 hours before

| Aspect | Detail |
|--------|--------|
| **Function** | `processReminders()` |
| **Timing** | Events starting within the next 24 hours |
| **Recipients** | Attendees with `status = "confirmed"` |
| **Email function** | `sendEventReminderNotification()` |
| **Subject** | `⏰ Reminder: "{title}" is tomorrow` |
| **CTA** | "View Event Details" button |
| **Tracking column** | `events.reminderSentAt` |
| **Purpose** | Heads-up for confirmed attendees |

### Show Events & Call Time

For show-type events (`eventType === "show"`), the reminder timing is based on `COALESCE(callTime, startTime)` — so if a show has a call time (performer arrival), that's the reference point for the 24h/48h windows. The 24-hour reminder email also displays call time in a special amber-colored badge.

### Tracking & Idempotency

- `reminderSentAt` and `confirmationReminderSentAt` on the `events` table prevent re-sending
- Both are set to `new Date()` after processing, even if zero emails were sent (all recipients had reminders disabled)
- `reminderSentAt` is reset to `null` when an event is rescheduled (time changed), so reminders fire again for the new time

### Discord Webhooks

`processReminders()` also sends a Discord webhook notification (one per event, not per attendee) via `sendEventReminderWebhook()`. This is fire-and-forget and independent of per-user preferences.

## Email Templates

Both reminder emails use the shared `emailLayout()` wrapper from `app/services/email.server.ts`:

- Green accent header ("My Call Time")
- Event card with emoji (🎭 show, 🎯 rehearsal, 📅 other)
- Title, group name, formatted date/time (in recipient's timezone)
- Location (📍) if provided
- CTA button (green)
- "Manage notification preferences" footer link
- Matching plain-text fallback

### Preference Filtering

Email functions check preferences internally:
```typescript
const prefs = mergeWithDefaults(recipient.notificationPreferences);
if (!prefs.showReminders.email) return; // skip this recipient
```

This happens per-recipient, so the cron job doesn't need to filter — it sends all eligible attendees and the email function respects each user's preferences.

## Testing

| Test File | What It Covers |
|-----------|----------------|
| `app/routes/groups.$groupId.notifications.test.ts` | Route loader/action, preference toggle, CSRF |
| `app/services/reminder.server.test.ts` | Cron job logic, timing windows, preference filtering, advisory locks, telemetry |
| `app/services/notification-preferences.test.ts` | `mergeWithDefaults()`, defaults, forward-compat |
| `app/services/email-notification-filtering.test.ts` | Per-recipient preference enforcement across email types |

## Common Tasks

### Adding a new notification category

1. Add to `NotificationPreferences` type in `src/db/schema.ts`
2. Add to `DEFAULT_NOTIFICATION_PREFERENCES`
3. Add checkbox entry in `NOTIFICATION_CATEGORIES` array in the notifications route
4. `mergeWithDefaults()` handles existing users automatically (no migration needed)
5. Add filtering in the relevant email send function

### Splitting the reminder toggle

If you need separate toggles for 24h vs 48h reminders (Option B from issue #117):
1. Add `confirmationReminders` to `NotificationPreferences` type
2. Update `DEFAULT_NOTIFICATION_PREFERENCES`
3. Add new checkbox in the notifications route
4. Update `sendConfirmationReminderNotification()` to check `confirmationReminders.email` instead of `showReminders.email`
5. Update `mergeWithDefaults()` — it handles this automatically
6. No DB migration needed (JSONB is schema-flexible)
