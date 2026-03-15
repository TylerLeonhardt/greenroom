# My Call Time — User Guide

Welcome to **My Call Time** — the scheduling platform built for improv groups, theater companies, bands, and any ensemble that needs to coordinate rehearsals, shows, and events.

**Here's how it works:**

1. An admin sends out an availability request — *"When is everyone free?"*
2. Members tap through each date: ✅ Available, 🤔 Maybe, or ❌ Unavailable
3. The admin sees a scored heatmap showing the best dates at a glance
4. The admin creates events from the top-scoring dates — members get notified automatically

No more group texts. No more spreadsheets. Just a clean path from *"when are you free?"* to *"see you Thursday."*

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
  - [Account Info](#account-info)
  - [Deleting Your Account](#deleting-your-account)
- [For Group Admins](#for-group-admins)
  - [Admin-Only Features](#admin-only-features)
  - [Group Settings](#group-settings)
  - [Discord Webhook Setup](#discord-webhook-setup)
  - [Deleting a Group](#deleting-a-group)

---

## Getting Started

### Creating an Account

When you first visit My Call Time, you'll see the landing page with the tagline **"Never miss your call time"** and a description of the platform's features: Find Availability, Smart Scheduling, Manage Shows, and Built for Groups.

Click **"Get Started Free"** to begin. You'll land on the sign-up page titled **"Create your account"**.

You have two options:

- **Sign up with Google** — Click the **"Sign up with Google"** button at the top. You'll authorize with your Google account and be taken straight to your dashboard.
- **Sign up with email** — Fill in these four fields:
  - **Name** — Your display name (how others in your groups will see you)
  - **Email** — Your email address (used for login and notifications)
  - **Password** — Minimum 8 characters. A color-coded strength meter appears below the field as you type: red for weak, amber for medium, green with "Strong" for 8+ characters
  - **Confirm password** — Must match exactly

Click **"Create account"** and you'll be taken to a **"Check your email"** page. Open your inbox, find the verification email, and click the link. The link expires after 24 hours.

> **Didn't get the email?** Click **"Resend Verification Email"** on the check-email page. You can resend once per minute.

After verifying, you'll be redirected to the sign-in page with a success message. Sign in to access your dashboard.

At the bottom of the signup page there's a link: *"Already have an account? **Sign in**"*.

### Signing In

The sign-in page shows **"Welcome back"** at the top. You have two options:

- **Sign in with Google** — Click the button to authenticate with your Google account.
- **Sign in with email** — Enter your **Email** and **Password**, then click **"Sign in"**.

After signing in, you'll land on your **Dashboard**.

> **Reactivating a deleted account:** If you deleted your account within the last 30 days, signing in will automatically reactivate it and restore your data.

### Your Dashboard

The Dashboard is your home base — it greets you by name (e.g., *"Welcome back, Taylor Swift! 👋"*) and shows everything that needs your attention:

- **Action Required** — A section listing items that need your attention. Each item is a clickable card showing the request title, group name, and date range with a **"Respond →"** link. For example: *📋 "April Rehearsal Schedule" needs your response — The Improvables · Mar 21 – Apr 4, 2026 — Respond →*. Events waiting for confirmation also appear here.
- **Upcoming Events** — Cards showing your upcoming events across all groups. Each card displays the event type emoji and label (🎯 Rehearsal, 🎭 Show, or 📅 Other), the group name, event title, date/time, and location.
- **Your Groups** — At the bottom, a list of your groups with member counts and your role. Includes quick-action links: **"Create Group"** and **"Join Group"**.

The top navigation bar shows links to **Dashboard**, **Groups**, and **Settings**, plus your initials avatar and name with a **"Log out"** button.

---

## Groups

Groups are the heart of My Call Time. Each group has its own availability requests, events, and member list. You can belong to multiple groups at once.

### Creating a Group

1. From your Dashboard or the Groups page, click **"Create Group"**.
2. You'll see a form titled **"Create a Group"** with the subtitle *"Start a new improv group and invite your ensemble."*
3. Enter a **Group Name** (e.g., *"The Improvables"*).
4. Optionally add a **Description** (e.g., *"Chicago's finest improv troupe. Rehearsals Tuesdays, shows Fridays."*).
5. Click **"Create Group"**.

You'll automatically become the **Admin** and receive a unique 8-character invite code to share with others.

### Joining a Group

There are two ways to join:

**Using an invite link:**
If someone shares a join link (like `mycalltime.app/groups/join?code=ABCD1234`), just click it. If you're signed in, you'll join immediately.

**Using an invite code:**
1. Go to the **Groups** page. Right at the top, you'll see a text field labeled **"Have an invite code?"** with a placeholder *"Enter invite code"*.
2. Type in the 8-character code and click **"Join Group"**.

There's also a dedicated join page at **Groups → Join Group** in the navigation.

### Group Overview

Click on any group from the Groups list to open it. The group page shows the group name, description, and a **tab bar** with five tabs:

- **Overview** — The default view
- **Availability** — Scheduling polls
- **Events** — Rehearsals, shows, and other events
- **Notifications** — Your email notification preferences for this group
- **Settings** — Group administration (visible to admins)

The **Overview** tab has two columns:

**Left column — Members list:** Shows each member with their initials avatar, name, email, and role badge (Admin or Member). Admins see a **"Remove"** button next to each non-admin member.

**Right column — three sections:**
1. **Quick Stats** — Shows Members count, Upcoming Events count, and Open Availability count.
2. **Next Up** — A preview of upcoming events as clickable cards, with a **"View all →"** link to the full events list.
3. **Invite Code** — Displays the code in a monospace font (e.g., `DEMO2026`) with a copy icon button, plus a **"📋 Copy Invite Link"** button to share the full URL.

### Invite Codes

Every group has an 8-character invite code (like `DEMO2026`) displayed on the group Overview page and in Group Settings. Admins can:

- **Copy the code** by clicking the clipboard icon next to it
- **Copy the full invite link** with the **"📋 Copy Invite Link"** button
- **Regenerate the code** from Group Settings if the old one needs to be invalidated

> **Note:** Regenerating a code permanently invalidates the old one — any previously shared links or codes will stop working.

### Managing Members

From the group **Overview** tab, you can see all members listed with their initials avatar, full name, email address, and role badge (Admin or Member).

As an admin, you'll see a **"Remove"** button next to each non-admin member. Click it and confirm to remove them from the group.

> **Note:** You can't remove yourself or other admins from a group.

### Group Permissions

By default, only admins can create availability requests and events. Admins can change this under **Group Settings → Member Permissions**:

- **Allow members to create availability requests** — Members can create scheduling polls, not just admins
- **Allow members to create events** — Members can create rehearsals, shows, and other events

Each toggle has a description explaining what it enables. Click **"Save Permissions"** after making changes.

---

## Availability Requests

Availability requests are scheduling polls that help you find the best dates for your group. An admin (or a member with permission) creates a request, everyone responds, and a heatmap reveals the optimal dates.

### Creating an Availability Request

1. Navigate to your group and click the **Availability** tab.
2. Click the **"New Request"** button (with a ＋ icon) in the top-right corner.
3. You'll see the form titled **"Create Availability Request"** with the subtitle *"Ask your group when they're free."*

Fill in the form:

- **Title** (required) — A descriptive name like *"March Rehearsal Schedule"*. The placeholder text suggests this.
- **Description** (optional) — Click the **"Add description"** button to expand a text area. Toggling this off clears the description.
- **Date Range** (required) — Pick a **Start Date** and **End Date** using the date fields under the "Date Range" heading.
- **Select Days** — After setting the date range, a day picker appears under the "Select Days" heading. Use the quick-select buttons to speed things up:
  - **Weekdays (Mon–Fri)** — Select all weekdays in the range
  - **Weekends (Sat–Sun)** — Select all weekend days
  - **All Days** — Select every day in the range
  - **Clear All** — Deselect everything
  - A counter shows how many days are selected (e.g., *"12 days selected"*)
- **Response deadline** (optional) — Click **"Add response deadline"** to set when you'd like responses by. Responses are still accepted after this date, but it signals urgency.
- **Time range** (optional) — Click **"Add time range"** to specify the hours you're asking about (e.g., 7:00 PM – 9:00 PM). Your timezone is shown so members know the context.

Click **"Create Request"** when you're ready. All group members are notified by email (and Discord, if configured).

### Responding to an Availability Request

1. Click on a request from the Availability list, or from the **"Action Required"** section on your Dashboard. You'll see the request title, status badge (Open/Closed), description, date range, and time range.
2. The **"My Response"** tab shows a table with columns: **Date**, **Day**, and **Status**.
3. For each date, click one of three buttons:
   - ✅ **Available** — You can make it
   - 🤔 **Maybe** — You might be able to make it
   - ❌ **Unavailable** — You can't make it

   **Shortcuts at the top of the grid:**
   - **"All Available"** — Mark every date as available in one click
   - **"All Unavailable"** — Mark every date as unavailable
   - **"Clear"** — Remove all your selections and start over

   If the request includes a time range, you'll see it at the top of the grid: *"⏰ Time: 7:00 PM – 9:00 PM each day"*.

4. Click **"Submit Response"** at the bottom. The button is disabled until you've selected at least one date. After submitting, you'll see a green **"Response saved!"** confirmation banner.

You can update your response anytime while the request is open — just change your selections and click **"Update Response"**.

### Viewing Results

Click the **"Results"** tab on any availability request to see the aggregated view.

At the top you'll see how many members have responded (e.g., *"3/3 responded"*).

**The Results Table** shows every date with these columns:
- An **expand/collapse** arrow to see individual responses
- **Date** — The calendar date (e.g., Mar 22)
- **Day** — Day of the week (e.g., Sun)
- **✅** — Count of Available responses
- **🤔** — Count of Maybe responses
- **❌** — Count of Unavailable responses
- **—** — Count of people who haven't responded yet
- **Score** — Calculated as: Available × 2 + Maybe × 1. Higher scores mean more people are free.
- **Create Event** — A direct link to create an event on that date

The **top-scoring dates** are highlighted with a ⭐ star icon next to the date.

**Sorting:**
- **Date** — Chronological order (default)
- **Best First** — Highest scores at the top

**Expanding a row:** Click the arrow on any row to see who responded and how — e.g., *"Alex Rivera: Available, Jamie Lee: Unavailable, Taylor Swift: Available."*

**Select Dates mode:** Click the **"Select Dates"** button to enter batch selection mode. Check off the dates you want, or use quick-select buttons (**Select Top 5**, **Select All**, **Clear**). Then click **"Create N Events →"** to batch-create events.

### Sending Reminders

If some members haven't responded, admins see a **"Send Reminder"** button. Click it to email non-respondents a reminder. You can only send one reminder per minute.

### Editing an Availability Request

Admins and the request creator can click the **"Edit"** button (pencil icon) on the request detail page. You can modify the title, description, and dates. Optionally notify members of changes.

### Closing and Reopening Requests

Admins can click **"Close Request"** on the request detail page to stop accepting responses. The status badge changes from "Open" to "Closed." Click **"Reopen Request"** to re-enable responses later.

---

## Events

Events are the end result of the scheduling process — the rehearsals, shows, and gatherings you've planned.

### Viewing Events

Go to your group and click the **Events** tab. You'll see the events page with:

- **View toggle** — Switch between **List** (default) and **Calendar** views using the buttons in the top bar
- **Type filter** — A dropdown to filter by **All Types**, **🎭 Shows**, **🎯 Rehearsals**, or **📅 Other**
- **Create Event** button — In the top-right corner

**List view** organizes events into **Upcoming** and **Past** sections, each with a count (e.g., *"Upcoming (2)"*). Each event card shows:
- Event type emoji and label (🎯 Rehearsal, 🎭 Show, or 📅 Other)
- Event title
- Date and time
- Location (if set)
- Confirmation status (e.g., *"1/2 confirmed"*)

**Calendar view** shows a monthly grid with event dots on dates that have events. Navigate months with arrow buttons. Click a date to see events on that day.

### Creating an Event

1. From the Events tab, click **"Create Event"**.
2. The form has these sections:

   **Basic Details:**
   - **Title** (required) — Placeholder: *"e.g., Friday Night Show"*
   - **Event Type** (required) — Three radio buttons: **🎯 Rehearsal** (selected by default), **🎭 Show**, or **📅 Other**

   **Date & Time:**
   - Your timezone is shown (e.g., *"New York (EDT)"*) — click it to change
   - **Date** (required) — A date picker
   - **Start Time** (required) — Defaults to 19:00
   - **End Time** (required) — Defaults to 21:00
   - **Call Time** — Appears only when "Show" is selected. This is when performers need to arrive (before the show starts).

   **Additional Details:**
   - **Location** (optional) — Placeholder: *"e.g., Studio A, Main Theater"*
   - **Description** (optional) — Placeholder: *"Any additional details..."*

   **Cast Assignment** (shows only) — A list of group members you can select as performers.

3. Click **"Create Event"** to save, or **"Cancel"** to go back.

### Creating an Event from Availability Results

In the Results tab of any availability request, each row has a **"Create Event"** link. Clicking it takes you to the event creation form with:
- The **date** pre-filled from the selected row
- The **time range** pre-filled from the availability request
- Members who said **Available** pre-selected as performers (for shows)

### Batch Event Creation

Create multiple events at once from availability results:

1. On the Results tab, click **"Select Dates"** to enter selection mode.
2. Checkboxes appear next to each date. Use them individually or with quick-select buttons:
   - **Select Top 5** — Picks the 5 highest-scoring dates
   - **Select All** / **Clear**
3. A summary bar shows your selection count. Click **"Create N Events →"**.
4. **Configure** shared details: title, type, times, timezone. Optionally add description and per-date locations.
5. **Review** the event cards — one per date, showing all details.
6. Click **"Create N Events"** to create them all.

Members receive a single consolidated email listing all events, personalized based on their availability response (Available, Maybe, or no response). Members who said "Not Available" are not emailed.

### Event Types

| Type | Badge | Special Features |
|------|-------|-----------------|
| 🎯 **Rehearsal** | Default type | Standard attendee tracking |
| 🎭 **Show** | Selected via radio | Call time field, Performer/Viewer roles, self-registration |
| 📅 **Other** | For anything else | Standard attendee tracking |

### Call Time (for Shows)

Shows have a **Call Time** — when performers need to arrive, typically before the show starts.

On the event detail page, the call time is displayed prominently: *"Call Time: 9:00 PM (performers arrive)"*. Under "Your Status," performers see: *"📍 Arrive by 9:00 PM"*.

When performers download the iCal file via **"Add to Calendar"**, their calendar entry starts at the call time, not the show time. Viewers' calendar entries start at the regular show time.

### Cast Management

For **shows**, the event detail page has a **"Cast"** section showing assigned performers:
- Each performer is listed with their name, role ("Performer"), and status (Confirmed/Pending/Declined).
- Admins see an **"Add Performers"** button and a **"Remove"** button (✕ icon) next to each performer.
- A separate **"Attending"** section shows self-registered viewers.

### Confirming or Declining Attendance

When you're assigned to an event, a **"Your Status"** card appears on the event detail page showing:
- Your **Role** (e.g., "Performer")
- Your **arrival time** (for shows with call time)
- Your current status with action buttons:
  - If **Confirmed**: Shows a green checkmark and **"Change to Declined"** button
  - If **Pending**: Shows **"Confirm"** and **"Decline"** buttons
  - If **Declined**: Shows **"Change to Confirmed"** button

For shows, a **"Show Summary"** box displays: Performers count, Viewers count, Confirmed count, Pending count, and Declined count.

### Self-Registration

Group members not assigned to an event can self-register:
- **For shows:** Click **"I'll be there"** to register as a **Viewer**. Viewers see the regular show time (not the call time).
- **For rehearsals/other:** Click **"I'll be there"** to mark attendance.

### Navigating Between Events

On any event detail page, a **horizontal date carousel** at the top shows all events in the group. Each card displays the month, day number, day of week, and event type. The current event is highlighted. Click any card to jump to that event — a quick way to browse your schedule.

### Adding to Your Calendar

On any event detail page, click **"Add to Calendar"** (with a download icon) to download an `.ics` file. Import it into Google Calendar, Apple Calendar, Outlook, or any calendar app.

**Smart start times for shows:** Performers get the call time as the start; everyone else gets the regular show time.

### Editing an Event

Admins can click **"Edit"** (pencil icon) on the event detail page. Modify any details: title, type, date, times, location, description, or call time. Options at the bottom:
- **Notify members** (checked by default) — Email assigned members about changes
- **Request re-confirmation** — Reset everyone to "Pending" and ask them to re-confirm

Click **"Save Changes"** to apply.

### Deleting an Event

Scroll to the **"Danger Zone"** section on the event detail page. Click **"Delete Event"** and confirm. This permanently removes the event and all assignments.

---

## Notifications

### Email Notifications

My Call Time sends these emails:

| Notification | When It's Sent | Who Receives It |
|-------------|----------------|-----------------|
| **New Availability Request** | Admin creates a new request | All group members (except the creator) |
| **Availability Reminder** | Admin clicks "Send Reminder" | Members who haven't responded |
| **Availability Request Updated** | Admin edits a request | All group members |
| **New Event Created** | An event is created with assigned members | Assigned members |
| **Batch Events Created** | Multiple events from availability results | Members segmented by availability response |
| **Added to Event** | Member manually added to an event | The newly added member |
| **Event Updated** | Event edited with "notify" checked | All assigned members |
| **Event Re-confirmation** | Event edited with "re-confirm" checked | Previously confirmed/declined attendees |
| **Event Reminder (24h)** | Automated, 24 hours before | Confirmed attendees only |
| **Confirmation Reminder (48h)** | Automated, 48 hours before | Pending attendees only |

Batch event emails are consolidated — one email per member listing all events.

### Discord Channel Notifications

Groups can receive notifications in a Discord channel. See [Discord Webhook Setup](#discord-webhook-setup) for configuration.

### Managing Your Notification Preferences

Each group has its own notification settings:

1. Go to your group and click the **Notifications** tab.
2. The page shows **"Email Notifications"** with the subtitle *"Choose which email notifications you receive from this group."*
3. Toggle these categories on or off:
   - **Availability requests** — *"Get notified when someone creates a new availability request in this group"*
   - **Event notifications** — *"Get notified when events are created or you're assigned to an event in this group"*
   - **Event reminders** — *"Get reminder emails before upcoming events:"*
     - 48 hours before — a confirmation nudge if you haven't confirmed yet
     - 24 hours before — a reminder for events you've confirmed
4. Click **"Save Preferences"**.

All notification types are **enabled by default** when you join a group.

### Automated Reminders

My Call Time automatically sends reminders before events (when enabled):
- **Confirmation reminder (48h)** — Sent to members who haven't confirmed or declined yet
- **Event reminder (24h)** — Sent to confirmed attendees as a final heads-up. For shows, prominently displays the call time.

These respect your notification preferences.

---

## Account Settings

Click **"Settings"** in the top navigation bar to access your account settings.

### Display Name

Under the **"Display Name"** section (with a user icon), you'll see a text field pre-filled with your current name. This is how other group members see you. Edit it and click **"Save"**.

### Timezone

Under the **"Timezone"** section (with a globe icon), select your timezone from a dropdown of common timezones organized by region. Options include US timezones (New York, Chicago, Denver, Los Angeles, Anchorage, Honolulu, Phoenix), Canadian timezones, Latin American timezones, European timezones, Asian timezones, and UTC.

Click **"Save"** after selecting.

> Your timezone is **auto-detected** from your browser on first visit. You can change it anytime. The timezone is also available inline when creating availability requests or events.

### Account Info

The **"Account"** section shows your email address (read-only).

### Deleting Your Account

Scroll to the **"Danger Zone"** section. Click the **"Delete Account"** link, which takes you to a dedicated page explaining:
- What will happen to your data
- Groups where you're the only admin
- The 30-day recovery window

> **30-day recovery:** Your account is deactivated, not immediately deleted. Sign back in within 30 days to reactivate it automatically.

---

## For Group Admins

### Admin-Only Features

| Feature | Admin | Member (default) | Member (with permission) |
|---------|-------|-------------------|--------------------------|
| Create availability requests | ✅ | ❌ | ✅ (if enabled) |
| Create events | ✅ | ❌ | ✅ (if enabled) |
| Close/reopen availability requests | ✅ | ❌ | ❌ |
| Send reminders | ✅ | ❌ | ❌ |
| Batch event creation | ✅ | ❌ | ❌ |
| Edit/delete requests & events | ✅ (or creator) | Creator only | Creator only |
| Add/remove cast members | ✅ | ❌ | ❌ |
| Remove group members | ✅ | ❌ | ❌ |
| View & copy invite code | ✅ | ❌ | ❌ |
| Manage group settings | ✅ | ❌ | ❌ |
| Configure Discord webhook | ✅ | ❌ | ❌ |
| Delete the group | ✅ | ❌ | ❌ |

Members can always: view all content, respond to requests, confirm/decline events, self-register for shows, download iCal files, and manage their notification preferences.

### Group Settings

The **Settings** tab on the group page has five sections:

1. **Group Details** — Edit the group name and description. Click **"Save Changes"**.
2. **Invite Code** — Displays the current code (e.g., `DEMO2026`) with a **"Copy"** button. Click **"Regenerate invite code"** to create a new one (invalidates the old code).
3. **Member Permissions** — Two toggles:
   - *"Allow members to create availability requests"* — with description: *"Members can create scheduling polls, not just admins"*
   - *"Allow members to create events"* — with description: *"Members can create rehearsals, shows, and other events"*
   - Click **"Save Permissions"** after changes.
4. **Discord Webhook** — A URL field with the placeholder *"https://discord.com/api/webhooks/..."* and a helper text: *"In Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL."* Paste the URL and click **"Save Webhook"**.
5. **Danger Zone** — Delete the group. You must type the exact group name to confirm, then click **"Delete this group"** (the button stays disabled until the name matches).

### Discord Webhook Setup

1. **In Discord:** Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.
2. **In My Call Time:** Group → Settings → Discord Webhook → Paste URL → **"Save Webhook"**.
3. Click **"Send Test Message"** to verify.

### Deleting a Group

> ⚠️ **This is permanent and cannot be undone.**

1. Go to Group → Settings → Danger Zone.
2. Type the exact group name in the confirmation field.
3. Click **"Delete this group"**.

This permanently removes the group and all its data: members, availability requests, events, and assignments.

---

*Built with ❤️ for groups everywhere. Questions or feedback? Visit [mycalltime.app](https://mycalltime.app).*
