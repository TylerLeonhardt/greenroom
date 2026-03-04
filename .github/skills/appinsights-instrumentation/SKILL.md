---
name: appinsights-instrumentation
description: "Guidance for instrumenting Node.js/TypeScript apps with Azure Application Insights. Provides telemetry patterns, SDK setup, migration from classic to OpenTelemetry SDK, and infrastructure provisioning. USE FOR: how to instrument app, App Insights SDK, telemetry patterns, OpenTelemetry migration, custom telemetry, connection string setup. Complements azure-observability which covers broader monitoring/querying."
---

# App Insights Instrumentation Skill

Guidance for instrumenting applications with Azure Application Insights — SDK setup, code patterns, infrastructure provisioning, and configuration.

## When to Use This Skill vs azure-observability

| Skill | Focus |
|-------|-------|
| **appinsights-instrumentation** (this) | Setting up SDKs, modifying application code to emit telemetry, configuring connection strings, provisioning App Insights resources, migrating between SDK versions |
| **azure-observability** | Querying telemetry (KQL), viewing metrics, configuring alerts, dashboards, Log Analytics, Azure Monitor |

**Rule of thumb:** If the question is "how do I send telemetry?" → this skill. If it's "how do I query/view telemetry?" → azure-observability.

## Greenroom's Current Setup

Greenroom uses the **classic `applicationinsights` SDK** (v3.x) in `app/services/telemetry.server.ts`:

- Initialized at the top of `app/entry.server.tsx` (before other imports)
- Auto-collects requests, exceptions, dependencies, performance, and live metrics
- Cloud role set to `"mycalltime"`
- `getTelemetryClient()` and `trackEvent()` helpers for custom telemetry
- Graceful no-op when `APPLICATIONINSIGHTS_CONNECTION_STRING` is not set

The **modern replacement** is `@azure/monitor-opentelemetry` (OpenTelemetry-based). Microsoft recommends migrating to this for new features and long-term support.

## Prerequisites

- Node.js application (TypeScript or JavaScript)
- Azure subscription with an Application Insights resource (or ability to create one)
- App hosted on Azure (Container Apps, App Service, Functions, etc.)

## Instrumentation Guide

### 1. Collect Context

Before instrumenting, identify:
- **Language/Runtime:** For greenroom — TypeScript on Node.js 20
- **Framework:** Remix v2 with Vite
- **Hosting:** Azure Container Apps
- **Existing telemetry:** Classic `applicationinsights` SDK in `app/services/telemetry.server.ts`

### 2. Create the App Insights Resource

If an App Insights resource doesn't already exist:

- **Azure CLI:** See [scripts/appinsights.sh](scripts/appinsights.sh) for commands to create the resource, workspace, and query the connection string
- **Bicep (IaC):** See [examples/appinsights.bicep](examples/appinsights.bicep) for a deployable template

> **Note:** Greenroom has no IaC — infrastructure is managed manually via Azure CLI and the portal. The Bicep example is provided as a reference for teams that use IaC.

### 3. Modify Application Code

For Node.js/TypeScript apps, see [references/nodejs.md](references/nodejs.md) for the modern `@azure/monitor-opentelemetry` setup.

Key points:
- `useAzureMonitor()` must be called **before** importing other modules
- For ESM projects, use the `--import` flag: `--import @azure/monitor-opentelemetry/loader`
- The SDK auto-instruments HTTP, database calls, and popular frameworks

### 4. Configure Connection String

Set the `APPLICATIONINSIGHTS_CONNECTION_STRING` environment variable on your hosting platform.

For Azure Container Apps (greenroom's hosting):
```bash
az containerapp update \
  -n "$CONTAINER_APP_NAME" \
  -g "$RESOURCE_GROUP" \
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$CONNECTION_STRING"
```

See [scripts/appinsights.sh](scripts/appinsights.sh) for the full workflow including querying the connection string.

### 5. Migration: Classic SDK → OpenTelemetry

Greenroom currently uses the classic `applicationinsights` package. To migrate:

1. Install the new package: `npm install @azure/monitor-opentelemetry`
2. Remove the old package: `npm uninstall applicationinsights`
3. Replace the setup code in `app/services/telemetry.server.ts`:
   - **Before:** `appInsights.setup(connectionString).start()`
   - **After:** `useAzureMonitor({ azureMonitorExporterOptions: { connectionString } })`
4. Update custom telemetry calls to use OpenTelemetry APIs (spans, metrics) instead of `trackEvent()`/`trackException()`
5. The connection string env var (`APPLICATIONINSIGHTS_CONNECTION_STRING`) stays the same

> **Caution:** Test thoroughly — the OpenTelemetry SDK has different auto-instrumentation behavior. Some Remix-specific patterns may need manual span creation.

## SDK Quick References

| SDK | Reference |
|-----|-----------|
| `@azure/monitor-opentelemetry` (TypeScript) | [references/sdk/azure-monitor-opentelemetry-ts.md](references/sdk/azure-monitor-opentelemetry-ts.md) |
| Node.js setup guide | [references/nodejs.md](references/nodejs.md) |
