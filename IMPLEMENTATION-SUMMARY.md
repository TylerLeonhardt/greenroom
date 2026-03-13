# Draft Cart Prototype - Implementation Summary

## Overview

This prototype demonstrates the "Draft Cart" approach for batch event creation in GreenRoom. Users can create multiple events, save them as drafts, and publish them all at once with a single consolidated notification.

## Worktree Information

- **Working directory:** `/Users/tyleonha/Code/TylerLeonhardt/Personal/greenroom-batch-cart`
- **Branch:** `george/explore-batch-cart`
- **Dev server:** Running on port 3002 (configured in vite.config.ts)

## Key Features Implemented

### 1. Draft Storage (Prototype-Level)
- **File:** `app/lib/draft-storage.ts`
- Uses localStorage for prototype (would be DB in production)
- Functions: `saveDraftEvent`, `getDraftEvents`, `updateDraftEvent`, `deleteDraftEvent`, `getDraftCount`

### 2. Event Creation with Draft Option
- **File:** `app/routes/groups.$groupId.events.new.tsx`
- Added "Save as Draft" button alongside "Create & Publish"
- Draft events are saved locally without triggering notifications
- Form validation still applies

### 3. Draft Queue Page
- **File:** `app/routes/groups.$groupId.events.drafts.tsx`
- Lists all draft events with rich details
- Selection UI with checkboxes
- "Select All" / "Deselect All" functionality
- "Publish Selected" and "Publish All" buttons
- Edit and Delete actions per draft
- Visual feedback for selected items (emerald highlight)

### 4. Draft Badge in Navigation
- **File:** `app/routes/groups.$groupId.tsx`
- Amber badge showing draft count on "Events" tab
- Updates dynamically when drafts change
- Only shows when drafts exist

### 5. Draft Link on Events Page
- **File:** `app/routes/groups.$groupId.events._index.tsx`
- Prominent amber button: "X Drafts"
- Only appears when drafts exist
- Quick access to draft queue

### 6. Edit Draft Page
- **File:** `app/routes/groups.$groupId.events.drafts.$draftId.edit.tsx`
- Edit all event fields (title, type, date, time, location, description)
- Timezone selector
- Save changes and return to queue
- Cancel option

### 7. Publish Confirmation Modal
- Shows summary of events being published
- Clear messaging: "This will send **1 notification** to **X participants** about **Y events**"
- Numbered list of events for review
- Green confirmation box emphasizing batch notification
- Cancel and Confirm buttons

### 8. Success Feedback
- Alert message: "Published X events. 1 notification sent to Y group members."
- Drafts removed from queue
- Redirect to events page or updated queue

## User Flow

```
1. Create Event → Save as Draft
   ↓
2. Repeat for multiple events
   ↓
3. Notice badge: Events [6]
   ↓
4. Navigate to Events → Click "6 Drafts"
   ↓
5. Draft Queue appears
   ↓
6. Select events (individual or all)
   ↓
7. Optional: Edit/Delete drafts
   ↓
8. Click "Publish Selected" or "Publish All"
   ↓
9. Review in modal
   ↓
10. Confirm → ONE notification sent
```

## Files Modified/Created

### New Files
- `app/lib/draft-storage.ts` - Draft storage utilities
- `app/routes/groups.$groupId.events.drafts.tsx` - Draft queue page
- `app/routes/groups.$groupId.events.drafts.$draftId.edit.tsx` - Edit draft page
- `scripts/seed-drafts.js` - Mock data seeder
- `scripts/record-demo.mjs` - Playwright demo recorder (for real app)
- `scripts/record-standalone-demo.mjs` - Standalone demo recorder
- `DEMO-GUIDE.md` - Comprehensive demo guide

### Modified Files
- `app/routes/groups.$groupId.events.new.tsx` - Added draft button
- `app/routes/groups.$groupId.tsx` - Added draft badge
- `app/routes/groups.$groupId.events._index.tsx` - Added draft link
- `vite.config.ts` - Configured port 3002

## Demo Materials

### Video Recording
**Location:** `/tmp/greenroom-videos/approach-b-cart.webm`
- 1.4 MB WebM video
- Shows complete flow from draft queue to batch publish
- Demonstrates selection, editing, and confirmation

### Screenshots
All located in `/tmp/greenroom-videos/`:
1. `approach-b-01-events-with-badge.png` - Events page with draft badge
2. `approach-b-02-draft-queue.png` - Draft queue with all 6 drafts
3. `approach-b-03-select-one.png` - Single draft selected
4. `approach-b-04-multiple-selected.png` - Multiple drafts selected
5. `approach-b-05-all-selected.png` - All drafts selected
6. `approach-b-06-publish-modal.png` - Publish confirmation modal
7. `approach-b-07-modal-scrolled.png` - Modal scrolled to show more events
8. `approach-b-08-success.png` - Success state after publishing

### Standalone Demo
**Location:** `/tmp/greenroom-videos/demo.html`
- Fully functional standalone HTML demo
- No authentication required
- Pre-loaded with 6 mock draft events
- Interactive: click, select, edit, delete, publish
- Uses Tailwind CDN for styling

## Production Implementation Notes

### Database Changes
Add a `status` column to the `events` table:
```sql
ALTER TABLE events ADD COLUMN status VARCHAR(20) DEFAULT 'published' NOT NULL;
CREATE INDEX idx_events_status ON events(status);
```

Values:
- `'draft'` - Event is in draft state
- `'published'` - Event is live and visible

### Query Modifications
```typescript
// Get published events
const publishedEvents = await db.select()
  .from(events)
  .where(and(
    eq(events.groupId, groupId),
    eq(events.status, 'published')
  ));

// Get draft events
const draftEvents = await db.select()
  .from(events)
  .where(and(
    eq(events.groupId, groupId),
    eq(events.status, 'draft')
  ));
```

### Batch Publish API
```typescript
// Endpoint: POST /groups/:groupId/events/publish-batch
export async function publishDraftEvents(eventIds: string[], groupId: string) {
  await db.transaction(async (tx) => {
    // Update all events to published
    await tx.update(events)
      .set({ status: 'published' })
      .where(and(
        inArray(events.id, eventIds),
        eq(events.groupId, groupId)
      ));

    // Send ONE consolidated notification
    const eventsData = await tx.select()
      .from(events)
      .where(inArray(events.id, eventIds));

    const groupData = await getGroupWithMembers(groupId);
    await sendBatchEventNotification({
      events: eventsData,
      groupName: groupData.group.name,
      recipients: groupData.members,
    });
  });
}
```

### Notification Template
Create a new email template for batch notifications:
```typescript
export async function sendBatchEventNotification({
  events,
  groupName,
  recipients,
  eventUrl,
  preferencesUrl,
}) {
  // Single email listing all events
  const html = `
    <h2>${groupName} has created ${events.length} new events</h2>
    <ul>
      ${events.map(e => `
        <li>
          <strong>${e.title}</strong><br>
          ${formatEventTime(e.startTime, e.endTime)}<br>
          ${e.location ? `📍 ${e.location}` : ''}
        </li>
      `).join('')}
    </ul>
    <a href="${eventUrl}">View Events</a>
  `;

  // Send to all recipients (respecting notification preferences)
  await sendEmail({ ... });
}
```

## Benefits of This Approach

### User Experience
- ✅ Intuitive "shopping cart" metaphor
- ✅ Review before committing
- ✅ Flexible: can publish some now, some later
- ✅ Clear visibility of pending work
- ✅ Edit/delete drafts before publishing

### Technical
- ✅ Simple implementation (single status column)
- ✅ Works with existing event creation flow
- ✅ No complex wizard state management
- ✅ Scales to any number of events
- ✅ Clear notification consolidation point

### Business Value
- ✅ Reduces notification fatigue
- ✅ CEO can batch create 12 rehearsals → 1 email
- ✅ Supports different locations per event
- ✅ Maintains event-level granularity
- ✅ No accidental sends (draft safety)

## Testing the Prototype

1. **Start the dev server:**
   ```bash
   cd /Users/tyleonha/Code/TylerLeonhardt/Personal/greenroom-batch-cart
   npm run dev
   ```
   Server runs on http://localhost:3002

2. **Seed mock data:**
   - Open browser console
   - Paste content from `scripts/seed-drafts.js`
   - Run: `seedDrafts('your-group-id')`
   - Reload page

3. **Explore the flow:**
   - See badge on Events tab
   - Click "6 Drafts" button
   - Select events
   - Try editing a draft
   - Publish selected or all

4. **Or use standalone demo:**
   ```bash
   open /tmp/greenroom-videos/demo.html
   ```
   No setup required - fully self-contained!

## Commits

1. **4424b10** - Add draft cart prototype for batch event creation
   - Core functionality implementation
   - Draft storage, queue page, edit page
   - Navigation badges and links

2. **ad2a826** - Add demo guide and recording scripts
   - Demo documentation
   - Playwright recording scripts
   - Standalone HTML demo
   - Port configuration

## Next Steps (If Proceeding with This Approach)

1. Add `status` column to events table
2. Update all event queries to filter by status
3. Implement batch publish API endpoint
4. Create batch notification email template
5. Add draft filters to event list views
6. Add "View Drafts" link to event creation success message
7. Add draft count to API responses
8. Test notification consolidation
9. Add analytics for draft usage
10. Consider draft expiration (optional: auto-delete old drafts)

## Alternative Approaches Considered

This prototype focuses on the "Draft Cart" approach. For comparison, the CEO might also want to see:

**Approach A: Batch Creation Modal**
- Single form with "Add Another Event" button
- All events created in one submission
- Pros: Faster for similar events
- Cons: Can't save progress, less flexible

**Approach C: Calendar Range Picker**
- Select multiple dates in calendar
- Apply same details to all
- Pros: Visual, fast for regular schedules
- Cons: Assumes events are similar

The Draft Cart approach offers the best balance of flexibility, safety, and clarity.
