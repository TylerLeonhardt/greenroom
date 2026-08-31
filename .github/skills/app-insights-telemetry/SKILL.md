---
name: app-insights-telemetry
description: 'Query Azure Application Insights telemetry for greenroom (mycalltime) usage metrics. Use when the CEO asks about user counts, signups, availability requests, events, usage trends, or any telemetry/analytics question. Triggers on telemetry, analytics, metrics, users, signups, usage, App Insights, KQL, how many.'
---

# App Insights Telemetry Skill

Query Azure Application Insights to answer questions about greenroom (mycalltime) usage.

## When to Use

- CEO asks "how many users do we have?"
- CEO asks about growth, trends, or usage over time
- CEO asks about specific event counts or breakdowns
- Any question about greenroom analytics or metrics

## Setup

The App Insights instance is connected to the greenroom deployment. Query it using the Azure CLI:

```bash
az monitor app-insights query \
  --app "$APPINSIGHTS_APP_ID" \
  --analytics-query "<KQL_QUERY>" \
  --output table
```

If `APPINSIGHTS_APP_ID` is not set, check the greenroom Azure resource group or ask the CEO for the App Insights resource name. You can also use:

```bash
az monitor app-insights component show --query "[].{name:name, appId:appId}" --output table
```

## Custom Events Tracked

These events are tracked via `trackEvent()` in greenroom's `app/services/telemetry.server.ts`:

| Event Name | Properties | Tracked When |
|---|---|---|
| `UserCreated` | `method` ("email" or "google") | New user signs up |
| `AvailabilityRequestCreated` | `groupId` | Availability request created |
| `EventCreated` | `groupId`, `eventType` | Event (show/rehearsal/other) created |

## Common KQL Queries

### Total users (all time)
```kql
customEvents
| where name == "UserCreated"
| count
```

### Total availability requests (all time)
```kql
customEvents
| where name == "AvailabilityRequestCreated"
| count
```

### Total events (all time)
```kql
customEvents
| where name == "EventCreated"
| count
```

### New users over a time window
```kql
customEvents
| where name == "UserCreated" and timestamp >= ago(7d)
| count
```
Replace `7d` with `30d`, `90d`, etc.

### Availability requests over a time window
```kql
customEvents
| where name == "AvailabilityRequestCreated" and timestamp >= ago(7d)
| count
```

### Events over a time window
```kql
customEvents
| where name == "EventCreated" and timestamp >= ago(7d)
| count
```

### Signups by method (email vs Google)
```kql
customEvents
| where name == "UserCreated"
| summarize count() by tostring(customDimensions.method)
```

### Events by type (show/rehearsal/other)
```kql
customEvents
| where name == "EventCreated"
| summarize count() by tostring(customDimensions.eventType)
```

### Daily signup trend (last 30 days)
```kql
customEvents
| where name == "UserCreated" and timestamp >= ago(30d)
| summarize signups = count() by bin(timestamp, 1d)
| order by timestamp asc
```

### Activity by group
```kql
customEvents
| where name in ("AvailabilityRequestCreated", "EventCreated")
| summarize count() by tostring(customDimensions.groupId), name
```

### Full dashboard summary
```kql
customEvents
| where name in ("UserCreated", "AvailabilityRequestCreated", "EventCreated")
| summarize
    total = count(),
    last_7d = countif(timestamp >= ago(7d)),
    last_30d = countif(timestamp >= ago(30d))
  by name
```

## How to Execute

1. Build the appropriate KQL query from the templates above
2. Run it via `az monitor app-insights query`
3. Present results clearly to the CEO — use plain numbers, not raw JSON
4. For trend data, summarize the key insight (e.g., "Signups are up 20% week over week")

## Notes

- These events were added in PR #95 (March 2026). Data only exists from that point forward — earlier usage isn't captured.
- App Insights also auto-collects requests, exceptions, dependencies, and performance metrics from the greenroom server.
- If you need metrics that aren't tracked yet, suggest adding new `trackEvent()` calls to the greenroom codebase.
