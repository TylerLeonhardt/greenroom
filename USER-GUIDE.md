# My Call Time — User Guide

Welcome to **My Call Time**, a scheduling platform built for groups that need to coordinate rehearsals, shows, and events. Whether you're part of an improv troupe, theater company, band, or any group that needs to find the best times to get together — My Call Time makes it easy.

**The core workflow is simple:**

1. An admin sends an availability request — *"When is everyone free?"*
2. Members respond with their availability for each date
3. The admin sees a color-coded heatmap of the best dates
4. The admin creates events from the top dates — members get notified automatically

No more group texts. No more spreadsheets. Just a clean workflow from *"when are you free?"* to *"see you Thursday."*

---

## Table of Contents

- [Getting Started](#getting-started)
  - [Creating an Account](#creating-an-account)
  - [Signing In](#signing-in)
  - [Your Dashboard](#your-dashboard)
- [Groups](#groups)
  - [Creating a Group](#creating-a-group)
  - [Joining a Group](#joining-a-group)
  - [Group Overview](#group-overview)
  - [Invite Codes](#invite-codes)
  - [Managing Members](#managing-members)
  - [Group Permissions](#group-permissions)
- [Availability Requests](#availability-requests)
  - [Creating an Availability Request](#creating-an-availability-request)
  - [Responding to an Availability Request](#responding-to-an-availability-request)
  - [Viewing Results](#viewing-results)
  - [Sending Reminders](#sending-reminders)
  - [Editing an Availability Request](#editing-an-availability-request)
  - [Closing and Reopening Requests](#closing-and-reopening-requests)
- [Events](#events)
  - [Viewing Events](#viewing-events)
  - [Creating an Event](#creating-an-event)
  - [Creating an Event from Availability Results](#creating-an-event-from-availability-results)
  - [Batch Event Creation](#batch-event-creation)
  - [Event Types](#event-types)
  - [Call Time (for Shows)](#call-time-for-shows)
  - [Cast Management](#cast-management)
  - [Confirming or Declining Attendance](#confirming-or-declining-attendance)
  - [Self-Registration](#self-registration)
  - [Navigating Between Events](#navigating-between-events)
  - [Adding to Your Calendar](#adding-to-your-calendar)
  - [Editing an Event](#editing-an-event)
  - [Deleting an Event](#deleting-an-event)
- [Notifications](#notifications)
  - [Email Notifications](#email-notifications)
  - [Discord Channel Notifications](#discord-channel-notifications)
  - [Managing Your Notification Preferences](#managing-your-notification-preferences)
  - [Automated Reminders](#automated-reminders)
- [Account Settings](#account-settings)
  - [Display Name](#display-name)
  - [Timezone](#timezone)
  - [Deleting Your Account](#deleting-your-account)
- [For Group Admins](#for-group-admins)
  - [Admin-Only Features](#admin-only-features)
  - [Group Settings](#group-settings)
  - [Discord Webhook Setup](#discord-webhook-setup)
  - [Deleting a Group](#deleting-a-group)

---

## Getting Started

### Creating an Account

1. Visit the My Call Time homepage and click **"Get Started Free"**.
2. You can sign up two ways:
   - **With Google** — Click **"Sign up with Google"** and authorize with your Google account. You'll be taken straight to your dashboard.
   - **With Email** — Fill in your name, email, and a password (minimum 8 characters). A strength meter below the password field shows how strong your password is. Click **"Create account"**.
3. If you signed up with email, you'll be taken to a **"Check your email"** page. Open your inbox, find the verification email, and click the verification link. The link expires in 24 hours.
4. After verifying your email, you'll be redirected to the sign-in page with a confirmation message. Sign in with your credentials to access your dashboard.

> **Didn't receive the email?** On the "Check your email" page, click **"Resend Verification Email"** to get a new one. You can resend once per minute.

### Signing In

1. Go to the sign-in page and enter your email and password, or click **"Sign in with Google"**.
2. After signing in, you'll land on your **Dashboard**.

> **Reactivating a deleted account:** If you previously deleted your account within the last 30 days, signing in will automatically reactivate it.

### Your Dashboard

The Dashboard is your home base. It shows you everything that needs your attention at a glance:

- **Action Required** — A yellow section at the top listing items that need your response:
  - **Availability requests** waiting for your response, with their date ranges and deadlines
  - **Events** waiting for you to confirm or decline attendance
  - If everything is handled, you'll see a friendly *"You're all caught up!"* message with a ✅
- **Upcoming Events** — A grid of your upcoming events across all groups, showing the event type, date/time, location, and your attendance status.
- **Your Groups** — Quick links to your groups, showing member counts and your role (Admin or Member). If you're in more than four groups, click **"View all groups"** to see the full list.

If you're new and haven't joined any groups yet, the Dashboard will prompt you to **Create a Group** or **Join a Group**.

---

## Groups

Groups are at the heart of My Call Time. Each group has its own availability requests, events, and member list. You can be in multiple groups at the same time.

### Creating a Group

1. From your Dashboard or the Groups page, click **"Create Group"**.
2. Enter a **Group Name** (required, up to 100 characters) — for example, *"The Improvables"*.
3. Optionally add a **Description** to tell members what the group is about.
4. Click **"Create Group"**.

You'll automatically become the **Admin** of your new group and receive a unique invite code to share with others.

### Joining a Group

There are two ways to join a group:

**Using an invite link:**
- If someone shares a join link with you (like `mycalltime.app/groups/join?code=ABCD1234`), simply click the link. If you're signed in, you'll join the group immediately. If you're not signed in, you'll be prompted to sign in or create an account first.

**Using an invite code:**
1. Go to the **Groups** page.
2. In the **"Have an invite code?"** section, type in the 8-character code.
3. Click **"Join Group"**.

You can also navigate to **Groups → Join a Group** for a dedicated join page with a larger code input.

### Group Overview

Click on any group to see its **Overview** page. This is the main hub for your group and includes:

- **Members list** — Shows every member with their name, email, role badge (Admin or Member), and profile photo.
- **Quick Stats** — At a glance: total member count, number of upcoming events, and number of open availability requests.
- **Next Up** — A preview of up to 3 upcoming events. Click **"View all →"** to see the full events list.
- **Invite Code** (admins only) — Your group's unique invite code and a **"Copy Invite Link"** button to share with prospective members.

Use the **tab bar** at the top of the group page to navigate between:
- **Overview** — Members, stats, and upcoming events
- **Availability** — Scheduling polls
- **Events** — Rehearsals, shows, and other events
- **Notifications** — Your notification preferences for this group
- **Settings** — Group settings (admin only)

### Invite Codes

Every group has an 8-character invite code (like `ABCD1234`) that anyone can use to join. Admins can:

- **Copy the code** to share via text or chat
- **Copy the full invite link** to share a clickable URL
- **Regenerate the code** from Group Settings if the old one needs to be invalidated

> **Note:** Regenerating a code permanently invalidates the old one — any previously shared links or codes will stop working.

### Managing Members

From the group **Overview** page, admins can:

- **View all members** with their names, emails, and roles
- **Remove a member** by clicking the **"Remove"** link next to their name. You'll be asked to confirm before the member is removed.

> **Note:** You can't remove yourself from a group.

### Group Permissions

By default, only admins can create availability requests and events. But admins can enable these permissions for regular members:

- **Allow members to create availability requests** — Members can create scheduling polls, not just admins.
- **Allow members to create events** — Members can create rehearsals, shows, and other events.

These settings are found under **Group Settings → Member Permissions**.

---

## Availability Requests

Availability requests are scheduling polls that help you find the best dates for your group. An admin (or a member with permission) creates a request, everyone responds, and a heatmap reveals the optimal dates.

### Creating an Availability Request

1. Navigate to your group and click the **Availability** tab.
2. Click **"New Request"**.
3. Fill in the form:

   - **Title** (required) — Give it a descriptive name, like *"March Rehearsal Schedule"*.
   - **Description** (optional) — Click **"+ Add description"** to expand a text field for extra context. Click **"Remove"** to hide it again.
   - **Date Range** (required) — Pick a **Start Date** and **End Date** to define the overall range.
   - **Select Dates** (required) — Choose specific dates within your range using the interactive calendar. Use the **quick-select buttons** for speed:
     - **Weekdays (Mon–Fri)** — Select all weekdays in the range
     - **Weekends (Sat–Sun)** — Select all weekend days
     - **All Days** — Select every day in the range
     - **Clear All** — Deselect everything and start over
     - A counter shows how many days you've selected (e.g., *"12 days selected"*)
   - **Response Deadline** (optional) — Click **"+ Add response deadline"** to set a deadline. Responses are still accepted after this date, but it signals urgency to members.
   - **Time Range** (optional) — Click **"+ Add time range"** to specify what hours you're asking about (e.g., 7:00 PM – 9:00 PM). This helps members know the expected time slot. Your timezone is shown — you can change it if needed.

4. A **Preview** section shows all your selected dates as tags.
5. Click **"Create Request"**.

All group members will be notified by email (and Discord, if configured) that a new availability request is waiting for their response.

### Responding to an Availability Request

1. Click on an availability request from the list (or from the "Action Required" section on your Dashboard).
2. On the **My Response** tab, you'll see a grid with every requested date.
3. For each date, click one of three buttons:
   - ✅ **Available** — You can make it
   - 🤔 **Maybe** — You might be able to make it
   - ❌ **Unavailable** — You can't make it

   **Shortcuts to save time:**
   - **"All Available"** — Mark every date as available
   - **"All Unavailable"** — Mark every date as unavailable
   - **"Clear"** — Remove all your responses to start over

4. Click **"Submit Response"** (or **"Update Response"** if you've already responded).

You can update your response anytime while the request is open. If you've already responded, your previous selections will be pre-filled.

> If the request is **closed**, the grid will be disabled with a message: *"This request is closed. Responses are no longer being accepted."*

### Viewing Results

Click the **Results** tab on any availability request to see the aggregated responses.

**The Heatmap** shows every requested date with:
- ✅ Count of people who said **Available**
- 🤔 Count of people who said **Maybe**
- ❌ Count of people who said **Unavailable**
- — Count of people who **haven't responded yet**
- A **Score** for each date, calculated as:
  - Each "Available" response = **2 points**
  - Each "Maybe" response = **1 point**
  - Unavailable and no response = **0 points**

**Color coding** makes it easy to spot the best dates at a glance:
- 🟢 **Green** (high score) — Most people are available. Great choice!
- 🟡 **Amber** (medium score) — Mixed availability. Consider carefully.
- 🔴 **Red** (low score) — Few people are available. Probably best to skip.
- ⭐ The **top 3 dates** by score are marked with a star icon.

**Sorting options:**
- **Date** — Chronological order (default)
- **Best First** — Highest scores at the top, so you can quickly find the best dates

**Expanding a date:** Click any row to expand it and see exactly who responded and what they said — for example, *"✅ Sarah — Available"*, *"🤔 Mike — Maybe"*.

A **progress bar** at the top shows how many members have responded (e.g., *"8/12 responded"*).

### Sending Reminders

If some members haven't responded yet, admins will see a **"Send Reminder"** button in the results view:

1. Look for the yellow *"Waiting for N more responses"* banner.
2. Click **"Send Reminder (N haven't responded)"**.
3. Non-respondents will receive an email (and a Discord notification, if configured) reminding them to respond.

> You can only send one reminder per minute to prevent spamming. The timestamp of the last reminder is displayed so you know when it was last sent.

### Editing an Availability Request

Admins and the request creator can edit an availability request:

1. On the request detail page, click the **"Edit"** button (pencil icon).
2. You can modify the **title**, **description**, and **selected dates**. (The time range, if set, cannot be changed after creation.)
3. Check or uncheck **"Notify members of this change"** (checked by default).
4. Click **"Save Changes"**.

If notifications are enabled and changes were made, all members will receive an email summarizing what changed.

### Closing and Reopening Requests

Admins can **close** an availability request to stop accepting responses:

- On the request detail page, click **"Close Request"**. The status badge changes to **"Closed"** and members can no longer submit or update responses.
- To reopen it later, click **"Reopen Request"**.

---

## Events

Events are the end result of the scheduling process — rehearsals, shows, and other gatherings. Once you know when everyone's free, create events and let your group know.

### Viewing Events

Go to your group and click the **Events** tab. You can view events two ways:

- **List View** (default) — Events organized into **Upcoming Events** and **Past Events** sections. Past events are collapsed by default — click to expand them.
- **Calendar View** — A monthly calendar with colored dots on dates that have events. Click a date to see the events on that day in a side panel.

**Filter by event type** using the dropdown: **All Types**, **Shows**, **Rehearsals**, or **Other**.

### Creating an Event

1. From the Events tab, click **"Create Event"**.
2. Fill in the form:
   - **Title** (required) — e.g., *"Friday Night Show"*
   - **Event Type** (required) — Choose **Rehearsal**, **Show**, or **Other**
   - **Date** (required) — Pick the event date
   - **Start Time** and **End Time** (required) — Set the time range. Defaults to 7:00 PM – 9:00 PM.
   - **Call Time** (shows only) — If you chose "Show", an additional field appears for when performers need to arrive (defaults to 6:00 PM). See [Call Time](#call-time-for-shows) for details.
   - **Timezone** — Shown inline; click to change if needed.
   - **Location** (optional) — Where the event takes place
   - **Description** (optional) — Any additional details
3. For shows, you can also select **cast members** from the group member list. See [Cast Management](#cast-management).
4. Click **"Create Event"**.

All assigned members (and the group via Discord, if configured) will be notified.

### Creating an Event from Availability Results

When viewing the results heatmap for an availability request, you can create events directly from the best dates:

**For a single date:**
1. In the results heatmap, find the date you want.
2. Click the **"Create Event"** link on that row.
3. You'll be taken to the event creation form with the date pre-filled.
4. Members who said they were available will be pre-selected in the cast assignment section.

**For multiple dates at once:** See [Batch Event Creation](#batch-event-creation) below.

### Batch Event Creation

Batch creation lets you create multiple events at once from your availability results — perfect for scheduling an entire month of rehearsals in one go.

1. In the results heatmap, click **"Select Dates"** to enter selection mode.
2. Select dates using checkboxes, or use the quick-select buttons:
   - **Select Top 5** — Automatically picks the 5 dates with the highest availability scores
   - **Select All** — Selects every date
   - **Clear** — Deselects all
3. A summary bar shows how many dates you've selected. Click **"Create N Events →"**.
4. **Step 1 — Configure:** Set the shared details for all events:
   - **Title** — Pre-filled with the availability request title
   - **Event Type** — Rehearsal, Show, or Other
   - **Start Time** and **End Time** — Pre-filled from the availability request's time range, or defaults to 7:00 PM – 9:00 PM
   - **Call Time** (shows only) — When performers should arrive
   - **Description** (optional) — Click **"+ Add description"** to add notes
   - **Locations** (optional) — Click **"+ Add locations per date"** to set a location for each event. Use **"Apply to All"** to set the same location for every date, or set them individually.
   - **Timezone** — Select the timezone for all events
5. Click **"Review Events →"** to proceed.
6. **Step 2 — Review:** See a preview card for each event showing the title, type, date, time, call time (if applicable), and location. Verify everything looks correct.
7. Click **"Create N Events"** to create all events at once.

You'll be redirected to the availability request page with a success message and a link to **"View Events →"**.

**Smart notifications:** Members receive a single consolidated email listing all the batch-created events, personalized based on their availability response:
- Members who said **"Available"** get a confirmation that they're booked
- Members who said **"Maybe"** are asked to confirm attendance
- Members who **didn't respond** are notified about the new events
- Members who said **"Not Available"** are **not** emailed

### Event Types

My Call Time supports three event types, each with a distinctive badge:

| Type | Badge | Special Features |
|------|-------|-----------------|
| 🎯 **Rehearsal** | Green | Standard attendee list |
| 🎭 **Show** | Purple | Call time field, Performer/Viewer roles, self-registration |
| 📅 **Other** | Gray | Standard attendee list |

### Call Time (for Shows)

Shows have an optional **Call Time** — the time performers need to arrive, which is typically earlier than the show start time.

- When creating or editing a show, a **"Call Time"** field appears below the start/end time fields.
- Call time must be before the show's start time.
- Performers see the call time prominently on the event detail page: *"Arrive by 6:00 PM"*.
- When performers download the iCal file, their calendar entry starts at the **call time**, not the show time. Viewers' calendar entries start at the regular show time.
- Reminder emails for shows include the call time prominently highlighted.

### Cast Management

For **shows**, cast management lets you assign performers:

**During event creation:**
- A **Cast Assignment** section appears when creating a show.
- If creating from availability results, members are grouped by their response:
  - ✅ **Available** members are pre-selected
  - 🤔 **Maybe** members are listed but not pre-selected
  - ❌ **Not Available** members are shown grayed out (still selectable if needed)
  - **No Response** members are listed and selectable
- Click on names to select or deselect them. A counter shows how many performers are selected.

**On the event detail page:**
- Admins can click **"Add Performers"** to add members after the event is created.
- If the event was created from an availability request, the add-performers panel groups members by their availability response for easy selection.
- Admins can **remove** assigned performers by clicking the ✕ button next to their name.
- Newly added performers receive an email notification.

For **rehearsals** and **other** events, the same system works but members are simply labeled as "cast" rather than "performers."

### Confirming or Declining Attendance

When you're assigned to an event, you'll see a **"Your Status"** card on the event detail page:

- **Pending** — You haven't responded yet. Click **"Confirm"** (✓) or **"Decline"** (✕).
- **Confirmed** — You've confirmed attendance. You can change your mind by clicking **"Change to Declined"**.
- **Declined** — You've declined. You can change by clicking **"Change to Confirmed"**.

Pending events also appear in your Dashboard under **"Action Required"** for easy access.

### Self-Registration

Any group member who isn't already assigned to an event can let their group know whether they'll attend:

**For shows:**
- On the show's detail page, look for the **"Attending?"** section.
- Click **"I'll be there"** to register as a **Viewer** (audience member), or **"I won't be there"** to indicate you won't attend.
- Viewers are separate from the performer cast list — viewers see the regular show start time (not the call time) in their calendar exports.

**For rehearsals and other events:**
- On the event detail page, look for the **"Attending?"** section.
- Click **"I'll be there"** to mark your attendance, or decline if you can't make it.

### Navigating Between Events

On any event detail page, a **horizontal carousel** at the top shows all events in the group. Each card displays the date, day of week, and event type badge. The current event is highlighted in green. Click any card to jump to that event — a quick way to browse through your schedule without going back to the list.

### Adding to Your Calendar

On any event detail page, click the **"Add to Calendar"** button (download icon) to download a calendar file that you can import into Google Calendar, Apple Calendar, Outlook, or any other calendar app.

**Smart start times for shows:**
- If you're a **Performer** and the show has a call time, your calendar event starts at the **call time** (when you need to arrive).
- For everyone else, the calendar event starts at the **regular show time**.

### Editing an Event

Admins and the event creator can edit an event:

1. On the event detail page, click the **"Edit"** button (pencil icon).
2. Modify any event details: title, type, date, times, location, description, or call time.
3. Two optional checkboxes at the bottom:
   - **"Notify members"** (checked by default) — Send an email and Discord notification about the changes.
   - **"Request re-confirmation"** — Reset all attendees back to "Pending" status and ask them to re-confirm. Useful when the date or time changes significantly.
4. Click **"Save Changes"**.

If notifications are enabled, members receive an email listing exactly what changed (e.g., *"Start time changed from 7:00 PM to 7:30 PM"*).

### Deleting an Event

Admins and the event creator can delete an event:

1. On the event detail page (or the edit page), scroll to the **Danger Zone** section.
2. Click **"Delete Event"**.
3. Confirm the deletion in the dialog. If the event has confirmed attendees, the confirmation will warn you about this.

> Deleting an event permanently removes it and all attendee assignments. This cannot be undone.

---

## Notifications

My Call Time keeps your group informed through email notifications and optional Discord webhook notifications.

### Email Notifications

Here's every email My Call Time sends and when:

| Notification | When It's Sent | Who Receives It |
|-------------|----------------|-----------------|
| **New Availability Request** | Admin creates a new request | All group members (except the creator) |
| **Availability Reminder** | Admin clicks "Send Reminder" | Members who haven't responded yet |
| **Availability Request Updated** | Admin edits a request | All group members |
| **New Event Created** | An event is created and members are assigned | Assigned members |
| **Batch Events Created** | Multiple events created from availability results | Members segmented by availability (available, maybe, no response) — *not* sent to those who said "Not Available" |
| **Added to Event** | A member is manually added to an event | The newly added member |
| **Event Updated** | An event is edited with "notify members" checked | All assigned members |
| **Event Re-confirmation** | An event is edited with "request re-confirmation" checked | Previously confirmed/declined attendees (reset to pending) |
| **Event Reminder (24 hours)** | Automated, 24 hours before event | Confirmed attendees only |
| **Confirmation Reminder (48 hours)** | Automated, 48 hours before event | Pending (unconfirmed) attendees only |

**Batch event emails are consolidated:** When multiple events are created at once, members receive **one email** listing all the events — not a separate email for each event.

Every email includes a link to **manage your notification preferences** at the bottom.

### Discord Channel Notifications

Groups can optionally receive notifications directly in a Discord channel. When configured, Discord receives notifications for:

- 📋 **New availability requests** — With the request title, date range, and creator name
- 🔔 **Availability reminders** — Lists who still needs to respond
- ✏️ **Updated availability requests** — Lists what changed
- 🎭 **New events** — With event details, date/time, and location
- 🎭 **Batch events created** — Numbered list of all events with dates and locations
- ✏️ **Updated events** — Lists what changed
- ⏰ **Event reminders** — 24 hours before the event

See [Discord Webhook Setup](#discord-webhook-setup) for how to configure this.

### Managing Your Notification Preferences

Each group has its own notification preferences, so you can customize notifications per group:

1. Go to your group and click the **Notifications** tab.
2. Toggle these email notification categories on or off:
   - **Availability requests** — New requests and reminders
   - **Event notifications** — Event creation, updates, and assignments
   - **Event reminders** — Pre-event reminders:
     - 48 hours before: a confirmation nudge if you haven't confirmed yet
     - 24 hours before: a reminder for events you've confirmed
3. Click **"Save Preferences"**.

All notification types are **enabled by default** when you join a group.

### Automated Reminders

My Call Time can automatically send reminders before events (when enabled by the app administrator):

- **Confirmation reminder** — Sent approximately **48 hours** before an event to members who haven't confirmed or declined yet. Asks them to confirm attendance.
- **Event reminder** — Sent approximately **24 hours** before an event to **confirmed attendees** as a final heads-up. For shows, the reminder prominently displays the call time.

These reminders respect your notification preferences — if you've turned off event reminders for a group, you won't receive them.

---

## Account Settings

Access your settings by clicking **"Settings"** in the navigation bar.

### Display Name

Your display name is how other group members see you.

1. Under **Display Name**, edit your name.
2. Click **"Save"**.

### Timezone

Your timezone controls how dates and times are displayed throughout the app.

1. Under **Timezone**, select your timezone from the dropdown (e.g., *"Eastern Time (US & Canada)"*).
2. Click **"Save"**.

> Your timezone is **auto-detected** from your browser when you first visit the app. You can change it anytime.

The timezone selector is also available inline when creating availability requests or events, so you can quickly adjust if needed.

### Deleting Your Account

If you need to delete your account:

1. Go to **Settings** and scroll to the **Danger Zone** section.
2. Click **"Delete Account"**.
3. You'll see a summary of what will happen:
   - How many groups you'll be removed from
   - How many availability requests and events you've created (which will be reassigned)
   - Your responses and event assignments will be removed
4. **If you're the only admin in any groups**, you'll need to make a decision for each one:
   - **Transfer ownership** to another member (select who from a dropdown)
   - **Delete the group** and all its data permanently
5. Click **"Continue"** to proceed.
6. On the confirmation page, type your **email address** to confirm.
7. Click **"Permanently Delete My Account"**.

> **30-day recovery window:** Your account is deactivated for 30 days before being permanently deleted. If you change your mind, simply sign in again during that window and your account will be reactivated automatically.

---

## For Group Admins

Admins have additional capabilities to manage their group effectively.

### Admin-Only Features

Here's a summary of what admins can do that regular members cannot (unless permissions are enabled):

| Feature | Admin | Member (default) | Member (with permission) |
|---------|-------|-------------------|--------------------------|
| Create availability requests | ✅ | ❌ | ✅ (if enabled) |
| Create events | ✅ | ❌ | ✅ (if enabled) |
| Close/reopen availability requests | ✅ | ❌ | ❌ |
| Send reminders to non-respondents | ✅ | ❌ | ❌ |
| Select dates for batch event creation | ✅ | ❌ | ❌ |
| Edit/delete availability requests | ✅ (or creator) | Creator only | Creator only |
| Edit/delete events | ✅ (or creator) | Creator only | Creator only |
| Add/remove cast members | ✅ | ❌ | ❌ |
| Remove group members | ✅ | ❌ | ❌ |
| View invite code & copy invite link | ✅ | ❌ | ❌ |
| Manage group settings | ✅ | ❌ | ❌ |
| Configure Discord webhook | ✅ | ❌ | ❌ |
| Delete the group | ✅ | ❌ | ❌ |

Members can always:
- View all group content (availability requests, results, events, member list)
- Respond to availability requests
- Confirm/decline event attendance
- Self-register as a viewer for shows
- Download iCal files
- Manage their own notification preferences

### Group Settings

Admins can access group settings from the **Settings** tab on the group page:

- **Group Details** — Update the group name and description.
- **Invite Code** — View, copy, or regenerate the invite code.
- **Member Permissions** — Enable or disable member creation permissions:
  - *"Allow members to create availability requests"*
  - *"Allow members to create events"*
- **Discord Webhook** — Connect a Discord channel for group notifications.
- **Danger Zone** — Delete the group (requires typing the group name to confirm).

### Discord Webhook Setup

To receive notifications in a Discord channel:

1. **In Discord:** Go to your server → **Server Settings** → **Integrations** → **Webhooks** → **New Webhook**.
2. Choose the channel where you want notifications to appear.
3. Click **"Copy Webhook URL"**.
4. **In My Call Time:** Go to your group → **Settings** → **Discord Webhook**.
5. Paste the webhook URL and click **"Save Webhook"**.
6. Click **"Send Test Message"** to verify it works — you should see a confirmation message in your Discord channel.

Once configured, your Discord channel will automatically receive notifications for new requests, events, reminders, and updates.

To remove the webhook, click **"Remove Webhook"** in the same settings section.

### Deleting a Group

> ⚠️ **This is permanent and cannot be undone.**

1. Go to your group → **Settings** → **Danger Zone**.
2. Type the exact group name to confirm.
3. Click **"Delete this group"**.

This permanently removes the group and all of its data: members, availability requests, events, and assignments.

---

*Built with ❤️ for groups everywhere. Questions or feedback? Visit [mycalltime.app](https://mycalltime.app).*
