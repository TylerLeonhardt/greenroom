# Read-only discovery and metric caveats

Preserved from #242 alongside the updated investigation in #243. Follow the
parent skill's privacy rules and single-replica/no-additional-cost constraint.
No live change is authorized by this reference.

Older setup notes claiming all resources are East US or minimum replicas zero
are stale. App Insights is workspace-backed; Log Analytics is Central US.
The deployment workflow deploys a SHA-tagged ACR image, not alerts.
No app deployment `azure.yaml` was present; instrumentation Bicep is an example,
not the production application's source of truth.

PostgreSQL Resource Health was supported, unlike ACA's 422
`UnsupportedResourceType`. Current health cannot establish historical health.
Missing auto-collected external dependency spans do not prove dependency health;
missing process telemetry during a stall is not evidence no requests failed.
User/session attribution was absent.

Use explicit fixed UTC `START` and `END`. First confirm the account:

```sh
az account show --query '{name:name,id:id,state:state}'
SUB=$(az account show --query id -o tsv)
BASE="https://management.azure.com/subscriptions/$SUB"
RG="$BASE/resourceGroups/greenroom-rg"
az resource list -g greenroom-rg --query '[].{name:name,type:type,location:location}'
az containerapp revision list -n greenroom -g greenroom-rg \
  --query '[].{name:name,created:properties.createdTime,active:properties.active,health:properties.healthState,replicas:properties.replicas}'
az monitor metrics alert list -g greenroom-rg
az rest --method get --url "$RG/providers/Microsoft.Insights/scheduledQueryRules?api-version=2023-12-01"
az rest --method get --url "$RG/providers/Microsoft.Insights/webtests?api-version=2022-06-15"
az rest --method get --url "$RG/providers/Microsoft.AlertsManagement/actionRules?api-version=2021-08-08"
az rest --method get --url "$RG/providers/Microsoft.AlertsManagement/smartDetectorAlertRules?api-version=2021-04-01"
az rest --method get --url "$RG/providers/Microsoft.Insights/components/mycalltime-insights/proactiveDetectionConfigs?api-version=2018-05-01-preview"
az rest --method get --url "$BASE/providers/Microsoft.AlertsManagement/alerts?api-version=2019-03-01&customTimeRange=$START/$END&pageCount=250"
```

Follow every `nextLink`. Inspect `properties.essentials.startDateTime`,
`monitorConditionResolvedDateTime`, `alertRule`, and `severity`. An individual
alert GET provides value/threshold/window context; its `/history` records actions.
Legacy `proactiveDetectionConfigs` is an array, not a `value` wrapper.

App Insights query examples (use the parent skill's explicit query time bounds):

```kusto
availabilityResults
| summarize records=count() by tostring(success)

availabilityResults
| where tobool(success)==false
| summarize failures=count(), avgMs=avg(duration), maxMs=max(duration) by location

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

Log Analytics examples:

```kusto
ContainerAppSystemLogs_CL
| where ContainerAppName_s == "greenroom"
| where Reason_s in ('Terminated','ContainerStarted','ContainerTerminated')
| summarize firstSeen=min(TimeGenerated), lastSeen=max(TimeGenerated),
    messages=make_set(Log_s,3), records=count() by ReplicaName_s, Reason_s
| order by firstSeen asc

ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "greenroom"
| extend p=parse_json(Log_s)
| where toint(p.level)>=40
| summarize records=count() by message=tostring(p.msg),
    errorCode=tostring(p.errorCode)
```

Discover metric names/aggregations with `az monitor metrics list-definitions`.
Query `az monitor metrics list --resource ARM_ID --start-time "$START" --end-time "$END"`
at PT5M, then PT1M around a firing:

- ACA `UsageNanoCores`, `WorkingSetBytes`, `RestartCount`, `Replicas`:
  Average/Maximum/Minimum. Correlate role instance/replica names, startup logs,
  and CPU/memory gaps: restart zero and replica count one do not exclude replacement.
- ACA `Requests`: Total, `--filter "statusCodeCategory eq '*'"`.
  Category `0xx` is not HTTP 500.
- PostgreSQL `cpu_percent`, `memory_percent`, `active_connections`,
  `cpu_credits_remaining`, `storage_percent`: Average/Maximum/Minimum.
  `connections_failed` uses Total; `max_connections` supports Maximum.
  DTU is not a PostgreSQL metric.
- App Insights `availabilityResults/availabilityPercentage`: Average;
  `requests/failed`: Count, `--filter "request/resultCode eq '*'"`.
  Full code values are `500`, `503`, etc.; `"5"` is not all 5xx.
  No fired error alert therefore does not prove there were no server errors.

```sh
az monitor activity-log list -g greenroom-rg --start-time "$START" --end-time "$END" --max-events 1000
git --no-pager log -20 --format='%h %aI %s'
gh run list --workflow deploy.yml --limit 25 --json createdAt,updatedAt,headSha,conclusion,url
```

Control-plane history can be empty despite platform churn. Reminder jobs run
every 15 minutes when enabled, with PostgreSQL advisory locks; check timestamps
instead of assuming cron is causal. Keep notification policy separate from
availability improvements, and obtain platform diagnostics for unexplained
replacements rather than attributing them to maintenance or OOM without evidence.
