# My Call Time — Product Vision

> **Read this first.** This document captures the product vision and guiding principles for My Call Time (GreenRoom). Every contributor — human or agent — should internalize these ideas before writing code.

## What We're Building

My Call Time is the one-stop scheduling hub for indie improv groups. Everything a group needs to organize rehearsals and shows, in one place.

We exist because every improv troupe, ensemble, and comedy team faces the same problem: "when is everyone free?" Our answer is a tight, purpose-built tool that handles the full lifecycle — from collecting availability to scheduling events to confirming who's showing up.

## The Core Loop

The fundamental user journey is:

```
Fill out availability → Get scheduled for an event → Confirm attendance
```

This loop is **sacred**. It must stay dead simple no matter how many features we add. Every proposed feature gets evaluated against one question: *"does this make the core loop harder?"* If yes, rethink it.

The average user will never touch settings, manage integrations, or explore power features. They do two things: respond to availability requests and confirm events. Those two interactions must be frictionless, fast, and obvious.

## Five Pillars

### 1. Feature Completeness

Everything an indie improv group needs to organize — nothing they don't.

The core loop is built: availability → events → assignments with confirm/decline. We continue listening for gaps and filling them — group stats ([#18](https://github.com/TylerLeonhardt/greenroom/issues/18)), reminders, deletion and GDPR controls ([#64](https://github.com/TylerLeonhardt/greenroom/issues/64), [#25](https://github.com/TylerLeonhardt/greenroom/issues/25)). But we never add features just because we can. Every feature must serve the organizing workflow.

### 2. Multi-Channel Delivery

Users communicate on different platforms. Email is live today. Discord integration is next ([#17](https://github.com/TylerLeonhardt/greenroom/issues/17)). Native push notifications and SMS are future possibilities.

The key architectural insight: **these are all delivery targets for the same information.** "Notify this user about this event" shouldn't care whether it's email, Discord, or push. The notification system must be channel-aware from the start — not email-specific with channels bolted on later.

The notification preferences work ([#62](https://github.com/TylerLeonhardt/greenroom/issues/62)) is the foundation. Build it right and every future channel slots in cleanly.

### 3. Extensibility

Adding a new notification channel, event type, or integration shouldn't require rewiring the core. Clean interfaces, adapter patterns.

The MCP server vision is a great example — it's just another way to surface schedule data. Design every feature as if someone will want to plug into it later.

**MCP as a data layer:** An MCP server positions My Call Time as not just a UI but a programmable data layer. An agent could check your schedule, auto-respond to availability requests based on your calendar, or suggest optimal rehearsal times. Design toward this future.

### 4. Controls Without Complexity

Users need granular control over notifications, deletion, and privacy. But the default experience must be zero-config: join a group, get notified, fill out availability, done.

**Progressive disclosure** — complexity is available but never forced:
- **Casual users** never see settings unless they go looking. Sensible defaults handle everything.
- **Power users** get per-group notification preferences, channel selection, and fine-grained controls.

### 5. Simplicity of the Core Loop (Non-Negotiable)

This is the most important pillar. It deserves its own section because it's easy to erode gradually.

No matter how many channels, integrations, and power features we add, **"fill out availability → confirm event" stays dead simple.** If a feature adds friction to this loop, it must be redesigned or rejected. There is no negotiation on this point.

## Integration Levels

| Channel | Status | Purpose |
|---------|--------|---------|
| Web UI | ✅ Live | Primary interface for all features |
| Email | ✅ Live | Transactional notifications, verification |
| iCal export | ✅ Live | Calendar integration (role-aware start times) |
| Discord | 🔜 Planned ([#17](https://github.com/TylerLeonhardt/greenroom/issues/17)) | Notifications where groups already communicate |
| MCP Server | 🔮 Future | Agent/AI integration — schedule as data layer |
| Native Push | 🔮 Future | Mobile notifications |
| SMS | 🔮 Future | Low-tech notification fallback |

## Design Principles

1. **Simple by default, powerful when needed.** The zero-config experience must work. Power features are opt-in.

2. **Delivery target abstraction.** Every notification has a channel-agnostic core. Never hardcode to a single delivery mechanism.

3. **Progressive disclosure.** Casual users see simplicity; power users find depth. The UI surface area grows only when the user asks for it.

4. **The core loop is sacred.** Availability → event → confirm. Protect it from feature creep, complexity, and unnecessary steps.

5. **Features serve the workflow.** We don't build features and then find workflows for them. We identify workflow gaps and fill them with the simplest feature that works.

6. **Extensible interfaces.** Design as if someone will integrate with it. Clean boundaries, adapter patterns, well-defined contracts.

## What We Don't Build

Knowing what we *won't* do is as important as knowing what we will:

- **We are not a general-purpose calendar.** Google Calendar exists. We handle the *group scheduling workflow* that calendars can't.
- **We are not a chat platform.** Discord and Slack exist. We deliver notifications *to* those platforms, not replace them.
- **We are not a venue/ticket management tool.** If it doesn't serve the "organize the group" workflow, it's out of scope.

## Current State (March 2025)

**What's built:**
- Full auth flow (email/password + Google OAuth, email verification)
- Group management with invite codes and configurable member permissions
- Availability requests with date ranges, time ranges, and response tracking
- Results heatmap with scoring (available×2 + maybe×1)
- Event creation from availability data with auto-assignment of available members
- Show events with call time, performer/viewer roles, and self-registration
- iCal export with role-aware start times
- Email notifications (fire-and-forget with graceful degradation)
- Dashboard with action items and upcoming events
- User timezone support (auto-detected, configurable)
- CSRF protection, rate limiting, structured logging, production telemetry

**What's next:**
- Notification preferences per group ([#62](https://github.com/TylerLeonhardt/greenroom/issues/62)) — foundation for multi-channel delivery
- Deletion support across the app ([#64](https://github.com/TylerLeonhardt/greenroom/issues/64)) — availability requests, events, groups, accounts
- Account deletion for GDPR compliance ([#25](https://github.com/TylerLeonhardt/greenroom/issues/25))
- Group stats page ([#18](https://github.com/TylerLeonhardt/greenroom/issues/18))
- Discord integration ([#17](https://github.com/TylerLeonhardt/greenroom/issues/17))
- Redis-backed rate limiting for multi-instance deployments ([#27](https://github.com/TylerLeonhardt/greenroom/issues/27))

---

*This is a living document. As the product evolves, update it — but the core loop and the five pillars should remain stable. They're the compass, not the map.*
