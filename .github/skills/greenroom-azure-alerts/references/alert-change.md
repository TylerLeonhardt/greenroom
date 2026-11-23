# Owner-approved alert change: preparation and rollback

**This runbook does not itself authorize Azure writes.** The owner separately
approved the six-resource change and subsequently explicitly authorized registering
only `Microsoft.AlertsManagement` on the greenroom subscription.

## Latest attempt: provider registered; backup preparation blocked

On 2026-11-23 registration was requested at **17:26:42 UTC** and polling first
confirmed **Registered at 17:28:02 UTC**. The resource-group processing-rule list
API succeeded with zero rules and no continuation. No other namespace was registered.

The execution environment then denied the command to prepare the required new
durable private backup, and denied a read-only check of its intended location:
`Permission denied because no interactive user response was available. Retry in an
interactive session so the user can approve it, or try an alternative that does not
require this permission.` No alternative access was attempted. The intended path
was `/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T172802Z`;
its existence/content is **unverified**, so it is **not a usable rollback source**.
The earlier two backups were not accessed or changed.

The alert apply stopped before any processing/scheduled/metric PUT. No payload
verification, propagation wait, or post-apply observation occurred. Read-back
completed **17:28:37 UTC**: all five rules' writable properties exactly match the
committed original baseline; all remain enabled, the exception rule remains Sev 1
with a 5m window/frequency, and suppression is absent (empty complete list).
These comparisons are against the committed baseline, not a new `.before.json`.
No alert rollback is needed or authorized by this attempt's ownership: it created
no processing rule. Provider registration can remain; rollback does not require
unregistering it. Evaluation health and actual fired/resolved email behavior of
the proposed configuration remain unverified because it is not installed.

## Historical prerequisite stops

The first PUT at 16:55 UTC
(recovery suppression) was rejected with HTTP 409 `MissingSubscriptionRegistration`:
the subscription is not registered for `Microsoft.AlertsManagement`. A read-only
provider GET confirmed `NotRegistered`. At that time provider registration was
outside the approval, so the operator stopped without registering or bypassing
suppression. The later explicit authorization and registration above supersede
that prerequisite, but not the fresh-backup requirement.

No mutation succeeded. All five rules were read back and exactly match their
`.before.json` bodies; suppression GET returned `ResourceNotFound` and the complete
processing-rule list was empty. No rollback writes were needed. The original
five-rule policy (including the broken `"5"` filter) remains live. The approved
combined rule, propagation, evaluation health, and real notification delivery
remain unverified. Read-only `attention.kql` returned no rows at 16:55:59 UTC.

The attempt's private durable backup is
`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T1655Z`.
Its raw source GETs, exact payloads, and SHA-256 manifest are retained there, not
in the repository or expiring session artifacts. All eleven payloads passed the
offline verifier; its isolated venv was removed. Pre-apply checksum, baseline,
drift, complete rule inventories, and both the paginated last-30-day and
unbounded current-state/older Fired-alert checks passed. Do not substitute this
backup for fresh preparation on a later authorized retry.

### Follow-up prerequisite stop: 2026-11-23 17:04 UTC

At 17:04 UTC a read-only provider GET still reported `Microsoft.AlertsManagement`
as `NotRegistered`. The follow-up stopped without retrying the rejected PUT or
issuing any other Azure write. Do not retry under an assumed authorization to
register the provider; resolving this subscription prerequisite needs a separate
owner decision outside the approved six-resource change.

Fresh private sources, payloads, checksums, and read-back evidence are retained at
`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T170404Z-guard-stop`.
All eleven bodies passed the offline verifier in an isolated venv, subsequently
removed. Read-back completed at 17:04:37 UTC: every existing rule's writable
properties match both this directory's `.before.json` and the committed baseline,
not the proposed `.after.json`. Suppression is absent (direct `ResourceNotFound`;
complete one-page list empty). Scheduled/metric inventories contain exactly one
and four rules. Both complete Fired-alert checks returned zero, including older
active incidents via an unbounded current-state query. Live `attention.kql`
returned no rows. No propagation wait or post-apply evaluation can validate the
uninstalled combined configuration; notification delivery remains unverified.

No rollback was needed and no processing-rule DELETE was authorized by ownership:
this follow-up created nothing. Its backup is only this follow-up's source, never
a replacement for the earlier attempt's backup. The guarded restoration sequence
below remains unchanged; do not execute it just to restore an unchanged state.

The original jq expressions in issue #241 generate valid request bodies.
The corrected process below additionally fails on pipeline errors, preserves
raw source definitions, follows processing-rule pagination, refuses an existing
suppression rule, and preserves omitted tags instead of introducing empty tags.
The five `.before.json` files restore every writable property, including the
original broken `"5"` result-code filter. Read-only ARM metadata is not a PUT
configuration property and is deliberately excluded. No action group changes.

## Provider-registration prerequisite — separate authorization required

First confirm the account subscription and read the provider registration state.
Only if separately authorized, register this one namespace and poll until
`Registered`. Stop on any registration error or missing permission; do not try
another registration route or bypass recovery suppression.

```bash
set -euo pipefail
SUB=b37965f1-4da2-4202-889d-82322392b4d5
test "$(az account show --query id -o tsv)" = "$SUB"
state=$(az provider show --subscription "$SUB" --namespace Microsoft.AlertsManagement \
  --query registrationState -o tsv)
if test "$state" != Registered; then
  # Execute only with separate registration authorization:
  az provider register --subscription "$SUB" --namespace Microsoft.AlertsManagement \
    --output none
fi
while test "$state" != Registered; do
  sleep 10
  state=$(az provider show --subscription "$SUB" --namespace Microsoft.AlertsManagement \
    --query registrationState -o tsv)
done
date -u '+Registered confirmed: %Y-%m-%dT%H:%M:%SZ'
```

Confirm read-only that the processing-rule list API works, follow every
`nextLink`, and stop if the expected empty inventory has changed. Then take a new
private durable backup below. Registration alone is not permission to skip any
backup, verification, checksum, drift, inventory, or quiet-state guard. The
namespace is now registered; future runs should not re-register it unnecessarily.

## Read-only preparation

Run in Bash from the #243 checkout. Set `BACKUP` to a **new, private, durable,
absolute directory path** whose parent exists; retain it outside the repository.
Do not use a new snapshot when rolling back an earlier apply.

```bash
set -euo pipefail
umask 077
: "${BACKUP:?Set BACKUP to a new durable absolute directory}"
case "$BACKUP" in /*) ;; *) echo "BACKUP must be absolute" >&2; exit 1 ;; esac
SUB=b37965f1-4da2-4202-889d-82322392b4d5
RG_ID="/subscriptions/$SUB/resourceGroups/greenroom-rg"
ROOT="https://management.azure.com$RG_ID/providers"
METRIC="$ROOT/Microsoft.Insights/metricAlerts"
LOG="$ROOT/Microsoft.Insights/scheduledQueryRules/mycalltime-exception-spike"
APR="$ROOT/Microsoft.AlertsManagement/actionRules/mycalltime-attention-no-recovery"
REFERENCE=.github/skills/greenroom-azure-alerts/references
test "$(az account show --query id -o tsv)" = "$SUB"
mkdir "$BACKUP"
mkdir "$BACKUP/source"
az rest --method get --url "$LOG?api-version=2023-12-01" > "$BACKUP/source/log.get.json"
az rest --method get --url "$METRIC?api-version=2018-03-01" > "$BACKUP/source/metrics.get.json"
# Stop and re-review if metric pagination or additional metric rules have appeared.
jq -e '.nextLink == null and (.value | length == 4)' "$BACKUP/source/metrics.get.json" >/dev/null

printf '{"value":[]}\n' > "$BACKUP/source/actionRules.get.json"
url="$ROOT/Microsoft.AlertsManagement/actionRules?api-version=2021-08-08"
page=0
while test -n "$url"; do
  page=$((page + 1))
  az rest --method get --url "$url" > "$BACKUP/source/actionRules.page$page.json"
  jq -e '.value | type == "array"' "$BACKUP/source/actionRules.page$page.json" >/dev/null
  jq --slurpfile next "$BACKUP/source/actionRules.page$page.json" \
    '.value += $next[0].value | .nextLink=$next[0].nextLink' \
    "$BACKUP/source/actionRules.get.json" > "$BACKUP/source/actionRules.next.json"
  mv "$BACKUP/source/actionRules.next.json" "$BACKUP/source/actionRules.get.json"
  url=$(jq -r '.nextLink // empty' "$BACKUP/source/actionRules.page$page.json")
done
jq -n --slurpfile scheduled "$BACKUP/source/log.get.json" \
  --slurpfile metrics "$BACKUP/source/metrics.get.json" \
  --slurpfile actionRules "$BACKUP/source/actionRules.get.json" \
  '{scheduled:($scheduled[0]|del(.systemData)),metrics:$metrics[0],actionRules:$actionRules[0]}' \
  > "$BACKUP/source/snapshot.json"
node "$REFERENCE/build-alert-payloads.mjs" "$BACKUP/source/snapshot.json" "$BACKUP/payloads"
shasum -a 256 "$BACKUP/source/"*.json "$BACKUP/payloads/"*.json > "$BACKUP/SHA256SUMS"
```

The raw log GET includes creator metadata: keep `source/` private. The sanitized
snapshot removes only `systemData`, not writable configuration. The committed
`snapshot-2026-11-23.json` records the verified baseline; the full raw originals
from this investigation are retained privately in its session artifacts.
The `verified-alert-payloads` CI artifact contains generated bodies and schemas,
not personal metadata, and expires after 30 days. It does not replace a durable
operator backup.

## Apply — approval required; not yet completed

Keep the variable definitions from preparation. Before writing, verify checksums,
re-GET and compare all five live rules' writable properties with the saved
`.before.json` files, and recheck all processing-rule pages for the reserved name.
Stop on drift, authentication failure, incomplete pagination, or an active incident.
Review all currently Fired alerts in Azure Monitor, including older incidents.
The subscription alerts API's default time range must not silently narrow that check.

For an explicit, paginated last-30-days check (conservatively stop on **any**
Fired alert; also check older active incidents in Azure Monitor):

```bash
shasum -a 256 -c "$BACKUP/SHA256SUMS"
url="https://management.azure.com/subscriptions/$SUB/providers/Microsoft.AlertsManagement/alerts?api-version=2019-03-01&monitorCondition=Fired&timeRange=30d&pageCount=250"
while test -n "$url"; do
  az rest --method get --url "$url" > "$BACKUP/fired-page.json"
  jq -e '(.value | type == "array") and
    ([.value[] | select(.properties.essentials.monitorCondition == "Fired")] | length == 0)' \
    "$BACKUP/fired-page.json" >/dev/null
  url=$(jq -r '.nextLink // empty' "$BACKUP/fired-page.json")
done
# Execute only within a separately owner-approved apply.
az rest --method put --url "$APR?api-version=2021-08-08" \
  --body @"$BACKUP/payloads/recovery-suppression.json" --output none
sleep 1800 # Allow up to 30 minutes for processing-rule propagation.
az rest --method put --url "$LOG?api-version=2023-12-01" \
  --body @"$BACKUP/payloads/log.after.json" --output none
for rule in mycalltime-app-unhealthy mycalltime-availability-alert \
            mycalltime-slow-response mycalltime-high-error-rate; do
  az rest --method put --url "$METRIC/$rule?api-version=2018-03-01" \
    --body @"$BACKUP/payloads/$rule.after.json" --output none
done
```

Read all five definitions back and compare the writable properties to the saved
after bodies. Read the recovery rule back too. Never inject production failures
to test notifications. PUT/query acceptance, propagation, and email delivery are
**not** proven by offline schema validation. There is no validation-only operation
in these resource-provider APIs. No ARM deployment/what-if call is needed or used.

## Rollback — approval required; not executed

Use the **same original backup**, not a fresh snapshot. Recheck account, checksums,
quiet state, and ownership of the recovery-processing rule. If that rule existed
before preparation, preparation must have stopped; never delete someone else's
rule. If it has since been changed by someone else, stop for review.

Restore metric coverage first, then the original query, then delete only the
processing rule created by this apply. If apply failed before creating that
rule, do not delete any rule. On a partial apply, restore all five saved bodies;
do not reconstruct them from memory or from proposed settings.
If the very first write is rejected and read-back proves nothing changed, there
is no partial apply to restore: do not issue unnecessary restoration writes.

```bash
test "$(az account show --query id -o tsv)" = "$SUB"
shasum -a 256 -c "$BACKUP/SHA256SUMS"
for rule in mycalltime-app-unhealthy mycalltime-availability-alert \
            mycalltime-slow-response mycalltime-high-error-rate; do
  az rest --method put --url "$METRIC/$rule?api-version=2018-03-01" \
    --body @"$BACKUP/payloads/$rule.before.json" --output none
done
az rest --method put --url "$LOG?api-version=2023-12-01" \
  --body @"$BACKUP/payloads/log.before.json" --output none
# Only if this apply created it and the ownership/state checks above passed:
az rest --method delete --url "$APR?api-version=2021-08-08" --output none
```

Re-GET all five rules and compare their writable properties to `.before.json`,
including enabled state, conditions, actions, severity, frequency, window,
auto-mitigation, and the original `"5"` filter. This restores configuration,
not past alert-instance state or notification history.
Do not unregister the provider as part of rollback.
