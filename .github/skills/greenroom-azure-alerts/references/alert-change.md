# Approval-only alert change: preparation and rollback

**No Azure writes are authorized by this runbook.** The current task verified
GETs, local body generation, and offline schemas only. Do not execute the apply
or rollback sections without separate owner approval.

The original jq expressions in issue #241 generate valid request bodies.
The corrected process below additionally fails on pipeline errors, preserves
raw source definitions, follows processing-rule pagination, refuses an existing
suppression rule, and preserves omitted tags instead of introducing empty tags.
The five `.before.json` files restore every writable property, including the
original broken `"5"` result-code filter. Read-only ARM metadata is not a PUT
configuration property and is deliberately excluded. No action group changes.

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

## Apply — approval required; not executed

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
# The following writes STILL require separate owner approval.
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
