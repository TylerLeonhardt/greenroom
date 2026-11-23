---
name: greenroom-azure-alerts
description: Read-only investigation of My Call Time Azure Monitor alerts, replica interruptions, telemetry correlation, and notification noise. Use for recurring Sev 2 alerts, availability failures, alert history, and greenroom production monitoring.
---

# Greenroom Azure Alert Investigation

Read `docs/vision.md`, `AGENTS.md`, and the `azure-diagnostics` /
`azure-observability` skills first. This runbook supplements their generic guidance.

## Safety and evidence

- Investigation is read-only unless the user separately authorizes a live change.
  Do not restart, scale, deploy, edit alert rules, change log levels, or add firewall rules.
- Start with `az account show`. If authentication is unavailable, stop Azure queries and
  report the limitation; do not work around authentication.
- Do not print container environment values, list secrets, or query database credentials.
  Use narrow `--query` projections; treat console logs and telemetry as sensitive.
- Public issues/PRs must not include user identifiers, email addresses, token-bearing URLs,
  calendar-feed tokens, OAuth codes, or raw request/dependency payloads. Redact even if
  telemetry was supposed to redact them.
- Distinguish observed failure mechanism, inferred trigger, and unproven hypotheses.
  An alert's fired-to-resolved interval is not the measured outage duration.

## Deployment map

Verified **2026-11-23**; rediscover live values rather than trusting this snapshot:

| Item | Resource / state |
|---|---|
| Subscription | Visual Studio Enterprise Subscription (`b37965f1-4da2-4202-889d-82322392b4d5`) |
| Resource group | `greenroom-rg` |
| Container App / environment | `greenroom` / `greenroom-env`, **Central US**, Consumption |
| Scaling / size | **Minimum 1**, maximum 3; 0.25 vCPU, 0.5 GiB per replica |
| Environment zones | `zoneRedundant=false`; two replicas would not imply zone redundancy |
| Ingress | `https://mycalltime.app`, external HTTPS, port 3000 |
| Database | PostgreSQL Flexible Server `greenroom-db`, Central US, PG16, Burstable B1ms, HA disabled |
| App Insights | `mycalltime-insights`, Central US, workspace-backed |
| Log Analytics | `workspace-greenroomrgLC11`, Central US |
| Registry | `greenroomcr`, **East US** |
| Notifications | `mycalltime-alerts`, CEO email receiver |

Older DevOps/setup notes say all East US and minReplicas=0; these are not live values.
The deployment workflow `.github/workflows/deploy.yml` deploys a SHA-tagged ACR image
on pushes to `master`. It does not manage alerts. No app-specific deployment IaC or
`azure.yaml` was present; the instrumentation skill's Bicep is only an example.

Discover without exposing configuration secrets:

```sh
az account show --query '{name:name,id:id,state:state}'
az resource list -g greenroom-rg --query '[].{name:name,type:type,location:location}'
az containerapp show -n greenroom -g greenroom-rg \
  --query '{state:properties.runningStatus,revision:properties.latestReadyRevisionName,scale:properties.template.scale,containers:properties.template.containers[].{image:image,resources:resources,probes:probes}}'
az containerapp revision list -n greenroom -g greenroom-rg \
  --query '[].{name:name,created:properties.createdTime,active:properties.active,health:properties.healthState,replicas:properties.replicas}'
az monitor log-analytics workspace show -n workspace-greenroomrgLC11 -g greenroom-rg \
  --query '{customerId:customerId,retention:retentionInDays}'
```

ACA Resource Health `availabilityStatuses/current` returned HTTP 422
`UnsupportedResourceType` during this investigation. This is not an auth failure.
Use ACA state/revision health, system logs, and metrics; PostgreSQL Resource Health
was supported. Current health does not prove historical health.

## Alert rules and history

Live rules at the snapshot:

| Rule | Sev | Actual condition | Evaluate / window |
|---|---|---|---|
| `mycalltime-app-unhealthy` | 2 | Average availability <**80%** | 5m / **15m** |
| `mycalltime-slow-response` | 2 | Average request duration >5000 ms | 5m / 5m |
| `mycalltime-high-error-rate` | 2 | Failed request Count >5, result-code filter `"5"` | 1m / 5m |
| `mycalltime-availability-alert` | 1 | At least two failing webtest locations | 1m / 5m |
| `mycalltime-exception-spike` | 1 | Exception Count >5, 1/1 failing periods | 5m / 5m |

All notify `mycalltime-alerts`. Metric-rule `autoMitigate` is omitted in GET responses;
the ARM default is true. The log rule explicitly sets true. Check actual history too.
The unhealthy rule's description still said <95% / 5m; trust its properties, not prose.

The standard webtest `mycalltime-health-ping` tests `/api/health` every 300 seconds
from three US locations (East, West, North Central), with a 30-second timeout,
expected HTTP 200, SSL validation and seven-day lifetime check. `RetryEnabled`
was unspecified. Do not infer retries from that null value.

Set `SUB` to the verified subscription ID. Supply your own fixed UTC start/end:

```sh
SUB=$(az account show --query id -o tsv)
BASE="https://management.azure.com/subscriptions/$SUB"
az monitor metrics alert list -g greenroom-rg
az rest --method get --url "$BASE/resourceGroups/greenroom-rg/providers/Microsoft.Insights/scheduledQueryRules?api-version=2023-12-01"
az rest --method get --url "$BASE/resourceGroups/greenroom-rg/providers/Microsoft.Insights/webtests?api-version=2022-06-15"
az rest --method get --url "$BASE/resourceGroups/greenroom-rg/providers/Microsoft.AlertsManagement/smartDetectorAlertRules?api-version=2021-04-01"
az rest --method get --url "$BASE/resourceGroups/greenroom-rg/providers/Microsoft.Insights/components/mycalltime-insights/proactiveDetectionConfigs?api-version=2018-05-01-preview"
az rest --method get --url "$BASE/providers/Microsoft.AlertsManagement/alerts?api-version=2019-03-01&customTimeRange=$START/$END&pageCount=250"
```

- Follow `nextLink` until absent. Inspect `properties.essentials.startDateTime`,
  `monitorConditionResolvedDateTime`, `alertRule`, and `severity`.
- Do **not** combine `timeRange` and `customTimeRange`: the API rejects it.
- If adding `includeContext=true`, `pageCount` must be **<=25**, not 250.
- Fetch an individual alert ID with `?api-version=2019-03-01` for metric value,
  threshold, and evaluation-window context; append `/history?api-version=2019-03-01`
  for system transitions and action-group execution.
- Empty smart-detector alert rules do not mean smart detection is off: legacy
  `proactiveDetectionConfigs` is a separate array API (not a `value` wrapper).

## Telemetry queries and traps

Run App Insights KQL with explicit `--start-time` and `--end-time`:

```sh
az monitor app-insights query -a mycalltime-insights -g greenroom-rg \
  --start-time "$START" --end-time "$END" --analytics-query "$KQL"
```

```kusto
availabilityResults
| summarize records=count() by tostring(success)

availabilityResults
| where tobool(success)==false
| project timestamp, location, duration, message
| order by timestamp asc

requests
| summarize records=count(), avgMs=avg(duration), maxMs=max(duration)
    by resultCode, tostring(success)

requests
| where toint(resultCode)>=500 or duration>5000
| extend safeName=iff(name contains '/api/calendar/', '[calendar feed redacted]', name)
| project timestamp, safeName, resultCode, duration, cloud_RoleInstance

exceptions | summarize records=count()

dependencies
| summarize records=count(), failed=countif(tobool(success)==false),
    avgMs=avg(duration), maxMs=max(duration)
    by name, type, probeCode=tostring(customDimensions.probeResultCode)
```

**Critical:** availability success was encoded `"0"` / `"1"`, while requests used
`"False"` / `"True"`. `success == false` returned zero availability failures!
Inspect distribution and normalize with `tobool(success)` before drawing conclusions.

Health probe dependencies preserve failure codes in `customDimensions.probeResultCode`
(#240); top-level `resultCode` can be `"0"` for success **and** failure.
Auto-collected dependency spans are incomplete; absent external API spans do not
prove external dependencies healthy. Missing process telemetry during a stall is
not proof that no requests failed. User/session attribution was absent.

Query Log Analytics with its **customer ID**, not its ARM resource ID:

```sh
az monitor log-analytics query --workspace "$WORKSPACE_CUSTOMER_ID" \
  --timespan "$START/$END" --analytics-query "$KQL"
```

```kusto
ContainerAppSystemLogs_CL
| where Reason_s in ('Terminated','ContainerStarted','ContainerTerminated')
| summarize firstSeen=min(TimeGenerated), lastSeen=max(TimeGenerated),
    messages=make_set(Log_s,3), records=count() by ReplicaName_s, Reason_s
| order by firstSeen asc

ContainerAppConsoleLogs_CL
| extend p=parse_json(Log_s)
| where toint(p.level)>=40
| summarize records=count() by message=tostring(p.msg),
    errorCode=tostring(p.errorCode)
```

Deduplicate repeated `Terminated` messages for the same replica. `RestartCount=0`
and `Replicas=1` do **not** exclude pod replacement: correlate `cloud_RoleInstance`,
`ReplicaName_s`, initialization logs, and gaps in CPU/memory samples.

## Metrics and deployment correlation

Discover names and supported aggregations with `az monitor metrics list-definitions`.
Use `az monitor metrics list --resource ARM_ID --start-time "$START" --end-time "$END"`
at PT5M, then PT1M around a firing:

- ACA: `UsageNanoCores`, `WorkingSetBytes`, `RestartCount`, `Replicas`;
  Average/Maximum/Minimum. Divide nanocores by 1e9 and bytes by 2^20 for cores/MiB.
- ACA `Requests`: Total, `--filter "statusCodeCategory eq '*'"`. `0xx` is not HTTP 500.
- PostgreSQL: `cpu_percent`, `memory_percent`, `active_connections`,
  `cpu_credits_remaining`, `storage_percent`; Average/Maximum/Minimum.
  `connections_failed` uses Total; `max_connections` supports Maximum.
  DTU is not a PostgreSQL metric.
- App Insights: `availabilityResults/availabilityPercentage` Average;
  `requests/failed` Count, `--filter "request/resultCode eq '*'"`.

The observed failed-request dimension values are full codes (`500`, `503`, etc.).
The live error alert's exact filter `"5"` does **not** select all 5xx. Record this
blind spot separately; a lack of fired error-count alerts is not proof of no 5xx.

```sh
az monitor activity-log list -g greenroom-rg --start-time "$START" --end-time "$END" --max-events 1000
git --no-pager log -20 --format='%h %aI %s'
gh run list --workflow deploy.yml --limit 25 --json createdAt,updatedAt,headSha,conclusion,url
```

Control-plane Activity Log can be empty despite platform replica churn. Check the
live image tag against deployment SHAs. Reminders run every 15 minutes when enabled,
with PostgreSQL advisory locks; check error timestamps rather than assuming cron is causal.

## Interpretation from the November investigation

[Issue #241](https://github.com/TylerLeonhardt/greenroom/issues/241) contains the full
report, eight incident pairs, evidence, remaining gaps, and ranked recommendations.

All eight recurring Sev 2 availability incidents coincided with replica replacement
and a short Sev 1 availability incident, without a contemporaneous deploy or sampled
resource exhaustion. The initiating host/runtime trigger remains unknown.

Two failed tests out of nine yield 77.78%, below the 15-minute rule's 80% threshold.
Rolling-window retention plus three healthy evaluations can leave Sev 2 fired for
22-25 minutes after a brief disruption. Do not call that continuous downtime or
silence the outage rule. Both rules and their recovery actions notify the CEO.

Minimum **two** replicas is an approval-required mitigation, not an implemented
fix or proof of host isolation. Minimum one is already configured. Escalate
unexplained replacements to Azure support; do not assert maintenance or OOM without
evidence. Separate notification-policy changes from availability improvements,
and keep all live changes pending explicit approval.
