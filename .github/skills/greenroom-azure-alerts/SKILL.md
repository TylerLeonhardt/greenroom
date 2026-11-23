---
name: greenroom-azure-alerts
description: Read-only investigation of My Call Time Azure Monitor alerts, replica interruptions, startup timelines, telemetry correlation, and notification noise. Use for recurring Sev 2 alerts, availability failures, alert history, and production monitoring.
---

# Greenroom Azure Alert Investigation

Read `docs/vision.md`, `AGENTS.md`, and the `azure-diagnostics` /
`azure-observability` skills first. This runbook supplements their generic guidance.
Issue #241 and PR #242 contain the original November 2026 investigation.
PR #243 consolidates both investigation PRs. The original discovery commands and
metric caveats are preserved in [references/read-only-discovery.md](references/read-only-discovery.md);
the later probe/startup findings below supersede the original causal hypotheses.

## Safety and evidence

- Azure investigation is read-only. Do not restart, deploy, scale, change probes,
  change alert rules, or send production test failures without separate approval.
  Do not change log levels or add firewall rules during investigation.
- **CEO constraint: retain the single-replica baseline. Do not recommend extra
  replicas, larger resources, or other cost-increasing changes.** This supersedes
  the two-replica recommendation in the original issue/PR.
- Start with `az account show`. If authentication is unavailable, stop Azure
  queries; do not work around authentication.
- Do not print container environment values, list secrets, or retrieve DB credentials.
  Public reports must exclude personal identifiers, addresses, tokens, raw request
  bodies, and token-bearing URLs. Aggregate at the source.
  Treat console logs and dependency payloads as sensitive even if automatic
  redaction was expected; redact calendar-feed tokens and OAuth codes too.
- Separate observed failure mechanism, inferred trigger, and unproven hypotheses.
  Alert fired-to-resolved duration is **not** measured outage duration.

## Resource map

Verified 2026-11-23; rediscover live values:

| Resource | Name / configuration |
|---|---|
| Subscription | `b37965f1-4da2-4202-889d-82322392b4d5` |
| Resource group | `greenroom-rg` |
| Container App / environment | `greenroom` / `greenroom-env`, Central US, Consumption |
| Capacity | min 1, max 3, 0.25 vCPU / 0.5 GiB; zone redundancy off |
| Ingress | `mycalltime.app`, external HTTPS, target port 3000 |
| PostgreSQL | `greenroom-db`, Central US, PG16, Burstable B1ms, HA off |
| App Insights | `mycalltime-insights`, Central US |
| Log Analytics | `workspace-greenroomrgLC11`, customer ID `01e90510-90f6-4f56-acee-06b96e630238` |
| Registry | `greenroomcr`, East US |
| Action group | `mycalltime-alerts`, one email receiver |

No application deployment IaC manages probes or alerts. Pushes to `master` trigger
the production deployment workflow. Investigation PRs must remain open for approval.
ACA Resource Health returned 422 `UnsupportedResourceType`; that is not an auth
failure. Use lifecycle logs, revision state, and metrics instead.

```sh
az account show --query '{name:name,id:id,state:state}'
az containerapp show -n greenroom -g greenroom-rg \
  --query '{state:properties.runningStatus,revision:properties.latestReadyRevisionName,scale:properties.template.scale,containers:properties.template.containers[].{image:image,resources:resources,probes:probes}}'
az monitor log-analytics workspace show -n workspace-greenroomrgLC11 \
  -g greenroom-rg --query '{customerId:customerId,retention:retentionInDays}'
```

## Probe configuration and health semantics

App-level GET returned `probes: null`; revision `greenroom--0000158` returned
`probes: []`. No custom HTTP probe or `/api/health` liveness path is configured.
The [documented ingress defaults](https://learn.microsoft.com/azure/container-apps/health-probes)
are TCP on port 3000, not database queries:

| Type | Documented defaults / observed limits |
|---|---|
| Startup | TCP, timeout 3s, period 1s, initial delay 1s, failure threshold 240, success threshold 1 |
| Readiness | TCP, timeout 5s, period 5s, initial delay 3s, failure threshold 48, success threshold 1 |
| Liveness | TCP; live system logs explicitly report 5s timeouts |

The revision API does **not** expose the platform-injected liveness period,
initial delay, or failure threshold. Do not invent effective values from generic
Kubernetes defaults. A TCP probe does not run `/api/health`; dependency-aware HTTP
liveness killing the container is not supported by this configuration.

`/api/health` is the DB-aware external synthetic/readiness endpoint: `SELECT 1`,
three attempts at 600ms, 400/800ms backoff, nominal total budget 3s, HTTP 503 after
exhaustion. An event-loop stall can delay JS timers beyond that budget.
Do not force this endpoint to return 200 when PostgreSQL is unreachable.

The eight incident replacements had exit-code-0 `Terminated` messages. Only
Nov 15 20:31 and Nov 19 07:28 explicitly say liveness failed / `ProbeFailure`;
the latter messages occur after the Nov 19 replacement started. This does not
establish why all eight original replicas stopped serving. Node maintenance,
eviction/rebalancing, and initiating process stalls require platform diagnostics;
absence of control-plane Activity Log entries does not rule those out.

## Read-only telemetry

Use explicit fixed UTC start/end. App Insights:

```sh
az monitor app-insights query -a mycalltime-insights -g greenroom-rg \
  --start-time "$START" --end-time "$END" --analytics-query "$KQL"
az monitor log-analytics query --workspace 01e90510-90f6-4f56-acee-06b96e630238 \
  --timespan "$START/$END" --analytics-query "$KQL"
```

- Availability `success` is `"0"` / `"1"`; requests use `"False"` / `"True"`.
  Normalize with `tobool(success)`; `success == false` silently missed failures.
- Availability **display name** is `My Call Time Health Check`, not the ARM
  webtest resource name `mycalltime-health-ping`. Locations: `East US`, `West US`,
  `North Central US`; each runs every 300s, 30s timeout.
- Health dependency failure codes are in `customDimensions.probeResultCode`.
  Top-level dependency `resultCode` can be `"0"` on failures too.
- Query Log Analytics with its customer ID, not its ARM ID.
- Use `p['time']`, not `p.time`, in KQL (the latter hits a parser keyword).
  `first` is also unsuitable as a bare aggregate alias; use `firstSeen`.
- Console `TimeGenerated` can lag source time. For structured pino request logs,
  use `unixtime_milliseconds_todatetime(tolong(p['time']))`.
- Console `msg == "request"` logs SSR rendering, **not every loader/action/API
  request**. Request telemetry, console counts, sampling (`itemCount`), and DB
  writes are different things. Do not equate HTTP 200 with successful signup.
- No signup honeypot exists in the inspected revision. CSRF, validation, and the
  per-process 5/min/IP limiter exist. Bot timing is not proof of bot account creation.
  Count `UserCreated` method=email and verification-email results separately;
  neither provides reliable attribution of human versus bot.
- Do not retrieve request bodies, address lists, or credentials to close an
  attribution gap. State what the available telemetry cannot prove.

## Startup timeline method

Collect system `AssigningReplica`, `PullingImage`, `PulledImage`,
`ContainerStarted`, `ProbeFailed`, `ContainerTerminated`, and `Terminated`
with replica name and time. Deduplicate repeated terminations per replica.
Image-pull **message duration** is more useful than subtracting log timestamps:
pull-start and pull-finished messages are often ingested together/out of order.

Console startup lines must be selected explicitly:

```kusto
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "greenroom"
| extend p=parse_json(Log_s)
| where Log_s startswith "Running database"
    or Log_s startswith "Migrations applied"
    or Log_s contains "Corepack is about to download"
    or Log_s startswith "> remix-serve"
    or Log_s startswith "[remix-serve]"
| project TimeGenerated, ContainerGroupName_s, Log_s
| order by TimeGenerated asc
```

`has_any("migration")` misses the plural word `migrations`. Redact internal
addresses from the server-listening line before publishing.

Across the eight replacements: image pulls 5-11s, container start to listening
4.19-6.15s, Corepack-download announcement to package script 1.79-2.99s.
Migration start/end lines share a timestamp (batched logging); only the whole
container-start-to-migration-completion bound, 0.84-1.39s, is defensible.
Termination-to-listening is 16.75-23.36s. Most of the observed interruption
precedes termination; removing pnpm is a small reliability improvement, not a
proven fix for the initiating stall. Startup failed probes occur while the new
port is not yet listening; do not add their durations to startup a second time.
First request after listening is traffic/probe-cadence dependent, not a measured
readiness initial delay. Some old replicas still emit responses after the first
termination message; do not treat that message as a precise process-death time.

## Alerts, notification counts, and replay

Live state reverified 2026-11-23 18:21:50 UTC: all five original rules remain
enabled and notify `mycalltime-alerts`:

| Rule | Severity / condition | Evaluation / window |
|---|---|---|
| app-unhealthy | 2; average availability <80% | 5m / 15m |
| availability-alert | 1; >=2 failing locations | 1m / 5m |
| slow-response | 2; average duration >5000ms | 5m / 5m |
| high-error-rate | 2; failed Count >5, broken result-code value `"5"` | 1m / 5m |
| exception-spike | 1; exceptions Count >5, 1/1 periods | 5m / 5m |

**Latest attempt, 18:20 UTC:** direct CLI use avoided the Copilot startup/trust
failure without changing trust settings or using MCP. The provider was already
Registered; all five original writable definitions matched the committed baseline
and suppression was absent before preparation. Fresh private originals, generated
bodies, and a SHA-256 manifest remain in
`.alert-apply/backup-20261123T182045Z/`, locally excluded and untracked in this
checkout on this machine. All four directories have mode 0700. Earlier external
backups were untouched.

Separate in-repository venv creation and `pip install --quiet jsonschema`
**succeeded**. The next, standalone verifier command was denied with
`Permission denied because no interactive user response was available`.
The runbook records the exact command and full denial. No alternate execution
route was tried. Offline verification and checksum validation did not complete;
these payloads are **not ready to apply**. The venv was removed and its absence
confirmed. Both Fired checks and the immediate pre-write duplicate-run guard
were not reached. No Azure write, rollback, schema correction, propagation wait,
or post-apply observation occurred.

Read-back at 18:21:50 UTC matched every writable property of all five fresh
`.before.json` bodies and the committed baseline. Suppression was absent (one
complete empty page); scheduled/metric inventories contained one/four rules
without continuation. Live `attention.kql` returned zero rows with API bounds
17:51:47/18:21:47 UTC. This is not evaluation evidence for the uninstalled
combined rule. Provisioning, query validation, evaluation health, propagation,
and real fired/resolved email behavior remain unverified. No rollback is needed;
this attempt created no processing rule and must not delete one.

**Earlier attempt, 18:11 UTC:** the owner-authorized repository-relative approach
also stopped at a permission denial, before any Azure write. The provider was
already Registered. Fresh originals, generated bodies, and a SHA-256 manifest
remain in `.alert-apply/backup-20261123T181118Z/`, private mode 0700, untracked
and excluded via `.git/info/exclude`, local to this checkout on this machine.
No earlier external backup was accessed. The in-repository venv was created,
but dependency installation/verifier/checksum execution was denied with
`Permission denied because no interactive user response was available`.
The runbook records the exact command and full error. No alternative route was
attempted; the venv was removed and its absence confirmed. Verification/checksums
did not complete, so these payloads are **not ready to apply**. Neither Fired
check nor the immediate pre-write duplicate-run guard was reached.

Read-back at 18:12:14 UTC matched all five fresh `.before.json` bodies and the
committed baseline exactly; suppression was absent (one complete empty page).
Scheduled/metric inventories contained one/four rules without continuation.
Live `attention.kql` returned zero rows with bounds 17:42:12/18:12:12 UTC. This is
not evaluation evidence for the uninstalled combined configuration. No rollback,
propagation/evaluation wait, merge, or deployment ran. This attempt created no
suppression rule and must not delete one. Real fired/resolved email behavior,
combined-rule provisioning, query validation, and evaluation remain unverified.

**Current path/permission lesson:** use only repository-relative local paths
under excluded `.alert-apply/`: durable timestamped backup and disposable `venv/`.
This supersedes historical outside-repository/session-local recommendations.
Never stage that directory or copy its backup elsewhere; stage explicit paths
only. Retain the backup and remove the venv after verification or a stop.
Relative paths do not guarantee permission: stop on any denial without trying
another route or changing trust settings. Provider registration can remain.
See the runbook for fresh-backup verification, every guard, and exact rollback.

**Earlier attempt, 17:59 UTC:** direct CLI use avoided the Copilot startup/trust
failure without changing trust settings or relying on MCP. The provider was
already Registered; no registration or other Azure write occurred.
Fresh originals, generated bodies, and a SHA-256 manifest were captured by
17:59:54 UTC at
`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T175951Z`
(root/source/payloads mode 0700); earlier backups were untouched.
Separate session-local venv creation succeeded, but the next command (dependency
installation, verifier, then checksums) was denied with
`Permission denied because no interactive user response was available`.
The exact command is in the runbook and #241. No alternative execution route
was attempted. Verification/checksums did not complete; payloads are not ready
to apply. Both Fired checks and the immediate pre-write duplicate-run guard
were not reached. No rollback or propagation/evaluation wait ran.
Read-back at 18:00:22 UTC matched every writable property of all five fresh
originals and the committed baseline. Suppression was absent (complete one-page
list); scheduled/metric inventories contained one/four rules without continuation.
Live `attention.kql` returned zero rows with bounds 17:30:22/18:00:22 UTC, not
evaluation-health evidence for the uninstalled combined configuration.
Real fired/resolved email behavior remains unverified. This attempt created
no processing rule and must not delete one; provider registration can remain.

**Earlier attempt, 17:51 UTC:** the provider was already `Registered`; it was
not registered again. Fresh originals, generated bodies, and a SHA-256 manifest
were captured by 17:51:26 UTC in the new private durable directory
`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T175116Z`
(root/source/payloads mode 0700). Earlier backups were left untouched.

The mandatory verifier command was denied with
`Permission denied because no interactive user response was available`
**despite placing the venv in this Copilot session's `files/` directory and
including no removal command**. No alternative execution route was attempted.
The exact command is recorded in the runbook and issue #241. No successful
offline verification or checksum validation is claimed; generated payloads
are not ready to apply. Full pre-write guards, including both Fired checks,
did not run. No Azure write, rollback, propagation wait, or post-apply observation
occurred. This attempt created no suppression rule and must not delete one.

Read-back at 17:51:52 UTC matched every writable property of all five fresh
`.before.json` bodies and the committed baseline. The complete suppression
inventory was empty (one page); scheduled/metric inventories contained one/four
rules without continuation. Live `attention.kql` returned zero rows with API
bounds 17:21:48/17:51:48 UTC. This is query execution, not evidence of evaluation
health for the uninstalled combined rule. Real fired/recovery email behavior
remains unverified; never inject production failures.

**Historical venv-location lesson (superseded above):** keep verifier venvs and scratch files in the current
Copilot session's `files/`, not under the durable backup directory. That location
avoids mixing disposable tooling with rollback evidence, but does not guarantee
execution permission. If the prescribed session-local command is denied, stop
before writes rather than changing trust settings, bypassing verification, or
trying another execution route. A future apply still needs a new backup and all
runbook guards. Provider registration can remain during alert rollback.

**Earlier attempt, 17:36 UTC:** read-only provider verification confirmed
`Microsoft.AlertsManagement` was already `Registered` at 17:36:06 UTC; it was
not registered again. The complete processing-rule inventory was empty.
Fresh raw originals, generated apply/rollback bodies, and a SHA-256 manifest
were successfully captured in the new durable private directory
`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T173606Z`
(backup/source/payload directories mode 0700). Earlier backups were left alone.

The environment then denied the isolated-verifier command with
`Permission denied because no interactive user response was available`.
No alternative execution route was attempted. Offline verification and checksum
validation did not complete; verifier-venv creation/removal cannot be confirmed.
Do not treat these generated payloads as verified or ready to apply. No alert
write, rollback, propagation wait, or post-apply observation occurred.
Read-back at 17:36:54 UTC exactly matched this attempt's fresh `.before.json`
bodies **and** the committed original baseline for all five rules. Suppression
was absent (complete one-page list empty). Live read-only `attention.kql`, with
API bounds 17:06:51/17:36:51 UTC, returned no rows; this is not evaluation-health
evidence for the uninstalled combined rule. Full pre-apply guards did not run.
The approved redesign remains **not live**. Real fired-email delivery and
resolved-email suppression remain unverified; never inject production failures.
No processing rule was created, so no DELETE is warranted. Provider registration
can remain. A later apply still needs fresh preparation and every runbook guard.

**Earlier registration attempt:** the owner explicitly authorized registration of only
`Microsoft.AlertsManagement` in addition to the six-resource alert change.
Registration was requested at 17:26:42 UTC and confirmed `Registered` at
17:28:02 UTC on 2026-11-23. The processing-rule list API worked and was empty,
without continuation. No other namespace was registered.

The environment denied required private durable backup preparation and then
denied a read-only check of its intended path, with
`Permission denied because no interactive user response was available`.
The intended path
`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T172802Z`
is **unverified, not a usable rollback source**. No alternative access was tried;
the earlier backups were left alone. No alert writes occurred; backup/venv
creation could not be verified, and no propagation/evaluation wait ran.
All five live writable definitions exactly matched the committed original
baseline at 17:28:37 UTC; suppression remained absent (complete list empty).
The approved redesign is still **not live**. No rollback is needed; do not delete
suppression this attempt did not create. Registration can remain and need not be
undone in an alert rollback. A future apply still requires a new accessible
private backup and every guard in the runbook. Actual combined-rule evaluation
and fired/resolved email behavior remain unverified.

**Historical stops:** the owner-approved combined-alert apply was blocked on its first PUT at
16:55 UTC: Azure returned `MissingSubscriptionRegistration` for
`Microsoft.AlertsManagement`; a read-only provider GET confirmed `NotRegistered`.
`mycalltime-attention-no-recovery` remains absent (direct GET `ResourceNotFound`,
complete processing-rule list empty). All five rules' writable properties still
exactly match the fresh `.before.json` bodies and the committed baseline.
No Azure mutation succeeded, no rollback writes were needed, and no provider
registration, merge, or deployment was attempted during that earlier run.
Registration was then outside the approved six-resource change; the explicit
later approval and registration above supersede that prerequisite.
The approved redesign is **not live**; the original broken `"5"` filter remains.

The 17:04 UTC follow-up confirmed `NotRegistered` with a read-only provider GET
and stopped at that prerequisite without retrying a PUT. All five writable
definitions match the committed baseline and fresh `.before.json` bodies;
direct suppression GET returns `ResourceNotFound` and its complete list is empty.
The new private evidence directory is
`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T170404Z-guard-stop`.
All eleven bodies passed offline verification, checksums passed, and the isolated
venv was removed. Both complete Fired checks (30-day API and unbounded current
state, including older incidents) returned zero; current `attention.kql` returned
no rows. This is not a post-apply evaluation: the combined rule is not installed.
No Azure writes or rollback were attempted. Keep each attempt's backup separate;
this follow-up cannot replace the original 16:55 rollback source.

The private durable backup for this attempt is
`~/.george/greenroom-alert-backups/issue-241-20261123T1655Z` on the operator's host.
Raw GETs must remain private. All eleven bodies passed offline verification,
checksums passed, and the isolated verifier venv was removed. Before the PUT,
the complete 30-day Fired-alert query and current-state Resource Graph query
(without an age filter, including older active incidents) both returned zero.
Live `attention.kql` returned no rows at 16:55:59 UTC. This is query execution,
not proof of the unapplied rule's evaluation health or notification delivery.
See issue #241 and [references/alert-change.md](references/alert-change.md) for
the failed attempt and guarded rollback sequence. Do not retry under an assumed
provider-registration authorization.

Metric `autoMitigate` is omitted (ARM default true); log rule explicitly true.
The unhealthy description is stale (<95% / 5m); trust actual properties.
The webtest expects HTTP 200, validates SSL with a seven-day expiry warning,
and does not specify `RetryEnabled`; null is not evidence that retries are on.
Two failures / nine samples = 77.78%. Window retention plus three healthy
evaluations explains 22-25 minute alert states after much shorter interruptions.

List metric rules, scheduled-query rules, webtests, action rules, smart-detector
rules, and legacy `proactiveDetectionConfigs` separately. Empty modern smart
detector results do not mean legacy proactive detection is off.

Alerts API: `customTimeRange=START/END&pageCount=250`, no `timeRange` alongside it.
Follow `nextLink`. `includeContext=true` requires pageCount <=25. For each
instance, GET `ALERT_ID/history?api-version=2019-03-01`; count
`properties.modifications[].modificationEvent == "ActionsTriggered"`.
The 16 historical instances have **32 action-group executions** (fired + resolved
for every instance), not proof of 32 delivered/read messages in the CEO inbox.

The owner-approved, currently blocked proposal reuses the existing 5-minute scheduled-query rule,
disables the four metric rules, and uses [references/attention.kql](references/attention.kql)
as a single non-dimensional Boolean condition (row Count >0, 1/1, window 15m,
Sev 2, autoMitigate true, existing action group). This combines sustained
two-location failure, persistent 5xx, and complete synthetic telemetry absence.
The dormant error metric filter is also corrected to full strings 500-599.
One stateful alert means overlapping symptoms do not send separate pages.
Use a narrowly scoped `Microsoft.AlertsManagement/actionRules@2021-08-08`
RemoveAllActionGroups rule with `MonitorCondition == Resolved` AND the exact
scheduled rule ID to suppress **only recoveries**. Propagation can take 30m.
This keeps the existing log-rule count/evaluation frequency and adds no compute
or notification service. Its first write was rejected; no configuration changed.
See [references/alert-change.md](references/alert-change.md) for read-only
preparation, exact rollback sources, and the separately approval-gated commands.
The `Alert payload verification` workflow generates all eleven request bodies
offline and checks the published REST schemas, minimal changes, and restoration.
The dated snapshot remains the verified original live state, not permission to
apply stale configuration. A later authorized retry needs fresh preparation and
guards; use an apply's own original backup for rollback, never a later snapshot.

Replay using all synthetic results plus 20m warm-up and all 500-599 request
samples (`sum(itemCount)` for weighting). Use relative age buckets for the three
5xx periods, not `bin(timestamp,5m)`: three calendar-aligned bins can miss
sustained errors when evaluation ticks have an offset. Evaluate rolling windows at every
5-minute tick and all five possible minute phases; normalize booleans. Historical
ingestion latency cannot be exactly reconstructed from event timestamps.
Simulate sustained outages **locally**, preserving real per-location cadence and
overriding successes to false; simulate sustained 5xx and no-data too. Never inject
production failures. Model stateful transitions rather than counting every
breaching evaluation as another notification.

Replay of 2026-11-13 00:00 through Nov 23 13:50 UTC: 9,138 availability
samples, 29 failures, maximum **one consecutive failure per location**. Five
evaluation phases (15,231 evaluations) produced zero proposed pages versus
32 recorded old-rule action-group executions. Fifty local 40-minute-outage
scenarios all fired after 11-19 minutes; fifty five-minute blips did not fire.
Sustained 5xx, missing telemetry, and simultaneous 5xx/outage scenarios each
produced one page per incident across all five phases. This is event-time replay,
not an exact Azure ingestion/notification-delivery simulation.

Resource metrics: ACA `UsageNanoCores`, `WorkingSetBytes`, `RestartCount`,
`Replicas`; PostgreSQL `cpu_percent`, `memory_percent`, `active_connections`,
`cpu_credits_remaining`, `storage_percent`. Discover supported aggregations.
Divide CPU nanocores by 1e9, bytes by 2^20. Replica replacement can leave
RestartCount=0 and Replicas=1; missing samples are not healthy samples.
Compare deploy history/image SHA and Activity Log before attributing churn to code.

## Production-image verification

The `container-e2e` job builds the PR's Dockerfile and invokes
`scripts/test-container.sh` on an isolated GitHub runner. See the
`greenroom-testing` skill for the assertions and artifact locations. Do not
substitute a direct-Node smoke test for building/running the actual image, and
do not bypass unavailable Docker tooling or local execution permissions.
