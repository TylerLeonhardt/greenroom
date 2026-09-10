---
name: creation-entry-point-chooser
description: Route related creation entry points through one chooser while preserving server-side permission enforcement
---

# Creation Entry Point Chooser

Use a single chooser page when one global creation affordance can start multiple related workflows.
The chooser should explain each option and route users to the existing dedicated creation forms.

## Canonical Pattern

`app/routes/groups.$groupId.create.tsx` is the canonical chooser:

- The group header's **Create** link routes to `/groups/:groupId/create`.
- Each card describes one workflow and links to its dedicated form.
- Card CTAs are visible when the user is an admin or the corresponding group permission is enabled.
- A user without permission sees a direct permission message instead of an actionable CTA.

Keep all creation entry points routed through the chooser rather than adding separate competing
buttons elsewhere.

## Permission Boundary

Client-side visibility checks are cosmetic only. They improve navigation but do not authorize a
request. Always enforce the same admin-or-permission rule in the destination route's loader and
action so direct URLs and forged requests cannot bypass it.

Canonical server-side examples:

| Creation flow | Route | Required enforcement |
|---|---|---|
| Availability request | `app/routes/groups.$groupId.availability.new.tsx` | Both loader and action call `requireGroupAdminOrPermission(request, groupId, "membersCanCreateRequests")`. |
| Event | `app/routes/groups.$groupId.events.new.tsx` | Both loader and action call `requireGroupMember()` and enforce `membersCanCreateEvents` with `groupMemberHasPermission()`, including the limited exception for a member creating an event from their own availability request. |

Never rely on a hidden header link, missing card CTA, or any other React condition as the security
boundary.

## Testing

Cover both sides of the chooser:

- An authorized admin or permitted member sees the header entry point and actionable card CTA.
- A member with creation permissions off sees no header **Create** link, sees the gated copy on the
  chooser, and sees no actionable card CTA.
- Destination route tests continue to verify server-side authorization independently of chooser
  visibility.

The acceptance example is `e2e/create-chooser.spec.ts`.
