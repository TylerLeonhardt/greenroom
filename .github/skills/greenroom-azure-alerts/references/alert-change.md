# Owner-approved alert change: preparation and rollback

**This runbook does not itself authorize Azure writes.** The owner separately
approved the six-resource change and subsequently explicitly authorized registering
only `Microsoft.AlertsManagement` on the greenroom subscription.

## Latest attempt: 18:11 UTC; repository-relative verifier also denied

On 2026-11-23 the owner authorized keeping this run's private rollback evidence
inside the checkout, excluded through `.git/info/exclude`, to avoid unattended
permission prompts for paths outside the repository. This supersedes the older
outside-repository/session-local path recommendations below; those remain
historical reports, not instructions for a new run.

From `george/fix-issue-241-startup`, the subscription matched and the provider
was already Registered. All five live writable definitions matched the original
baseline; the complete processing-rule inventory was empty. Fresh raw GETs,
snapshot, generated bodies, and a SHA-256 manifest were captured at:

`.alert-apply/backup-20261123T181118Z/`

The work, backup, source, and payload directories are mode 0700. The directory
is untracked, locally excluded, retained only in this checkout on this machine,
and must never be staged. Earlier backups outside the checkout were untouched.
`python3 -m venv .alert-apply/venv` succeeded, but this exact next command failed:

```bash
.alert-apply/venv/bin/pip install --quiet jsonschema && .alert-apply/venv/bin/python .github/skills/greenroom-azure-alerts/references/verify-alert-payloads.py .alert-apply/backup-20261123T181118Z/payloads && shasum -a 256 -c .alert-apply/backup-20261123T181118Z/SHA256SUMS
```

```text
Permission denied because no interactive user response was available. Retry in an interactive session so the user can approve it, or try an alternative that does not require this permission.
```

No alternative route was attempted. The tool did not identify which subcommand
required approval. **Relative paths do not guarantee unattended execution
permission.** Offline verification/checksum validation did not complete; these
payloads are not ready to apply. The venv was removed and its absence confirmed;
the backup remains in place. Both Fired checks and the immediate pre-write
duplicate-run guard were not reached. No Azure write, rollback, schema correction,
propagation wait, or post-apply observation occurred.

At **18:12:14 UTC**, all five rules matched every writable property of both this
backup's fresh `.before.json` bodies and the committed baseline. All remain
enabled, the original log rule remains Sev 1 / 5m window / 5m frequency, and the
error metric retains `["5"]`. Suppression was absent (complete one-page empty
inventory); scheduled/metric inventories contained one/four rules without
continuation. The provider remained Registered. Live `attention.kql` returned
zero rows with bounds **17:42:12/18:12:12 UTC**, not evaluation evidence for the
uninstalled combined configuration.

No rollback is needed and no processing-rule DELETE belongs to this attempt.
For any separately authorized restoration, first complete verification/checksums
and all quiet-state/ownership guards, then use the rollback section below with
`BACKUP=.alert-apply/backup-20261123T181118Z`. Restore its four metric originals,
then its log original; do not delete suppression this attempt did not create.
Provider registration can remain. Combined-rule provisioning, query validation,
evaluation health, propagation, and real fired/resolved email behavior remain
unverified; never inject production failures.

## Earlier attempt: 17:59 UTC; venv creation succeeded, next command denied

On 2026-11-23 the operator used the existing CLI tools directly, without
launching another Copilot process, relying on the unavailable MCP server, or
changing trust settings. The checkout was `george/fix-issue-241-startup`.
The account matched the approved subscription; `Microsoft.AlertsManagement`
was already Registered and was not registered again.

Fresh originals, generated bodies, and a SHA-256 manifest were captured by
**17:59:54 UTC** at
`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T175951Z`.
Root/source/payloads directories are mode 0700; earlier backups were untouched.
The separate `python3 -m venv` command succeeded in this session's `files/`.
The next command was denied:

```bash
/Users/tyleonha/.copilot/session-state/7c322cf2-f280-4468-b237-2eb1c1b09b03/files/alert-verifier-venv/bin/pip install --quiet jsonschema && /Users/tyleonha/.copilot/session-state/7c322cf2-f280-4468-b237-2eb1c1b09b03/files/alert-verifier-venv/bin/python .github/skills/greenroom-azure-alerts/references/verify-alert-payloads.py /Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T175951Z/payloads && shasum -a 256 -c /Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T175951Z/SHA256SUMS
```

```text
Permission denied because no interactive user response was available. Retry in an interactive session so the user can approve it, or try an alternative that does not require this permission.
```

The tool did not identify which subcommand required approval. No alternate
execution route or trust change was attempted. Offline verification and checksum
validation did not complete; these payloads are **not ready to apply**.
The session-local venv was subsequently removed and its absence confirmed.
Both Fired checks and the immediate pre-write duplicate-run guard were not
reached. No Azure write, schema correction, rollback, or propagation wait ran.

Read-back completed **18:00:22 UTC**: every writable property of all five rules
matched this backup's `.before.json` bodies and the committed original baseline.
All remain enabled, the original exception rule is Sev 1 with 5m/5m window and
frequency, and the error metric retains `["5"]`. The complete processing-rule
inventory was empty (one page); scheduled/metric inventories contained one/four
rules without continuation. The provider was still Registered.
Live `attention.kql` returned zero rows with API bounds
**17:30:22/18:00:22 UTC**. This is query execution, not combined-rule evaluation
health: the combined configuration is not installed. No post-apply observation
can validate it. Provisioning, query validation, propagation, evaluation history,
and real fired/resolved email behavior remain unverified; never inject failures.

No rollback is needed. If separately authorized restoration becomes necessary,
first complete verification/checksums and every quiet-state/ownership guard,
then use **this backup's** four metric `.before.json` bodies in the rollback
order below, followed by `log.before.json`. No processing-rule DELETE belongs
to this attempt, which created none. Provider registration can remain.
Session-local venv placement separates scratch from durable evidence but does
not guarantee permission to install dependencies or execute verification.

## Earlier attempt: 17:51 UTC; session-local verifier also denied

On 2026-11-23 the account matched the approved subscription and the provider
was already `Registered`. No registration was repeated. Fresh raw originals,
generated apply/rollback bodies, and a SHA-256 manifest were captured by
**17:51:26 UTC** at:

`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T175116Z`

The root, `source/`, and `payloads/` directories are mode 0700. Earlier backup
directories were not accessed or changed. The environment denied this exact
next command, even though its venv is session-local and it contains no removal:

```bash
set -euo pipefail
python3 -m venv /Users/tyleonha/.copilot/session-state/42da2978-3395-4018-bbdc-0852602b0b9f/files/alert-verifier-venv
/Users/tyleonha/.copilot/session-state/42da2978-3395-4018-bbdc-0852602b0b9f/files/alert-verifier-venv/bin/pip install --quiet jsonschema
/Users/tyleonha/.copilot/session-state/42da2978-3395-4018-bbdc-0852602b0b9f/files/alert-verifier-venv/bin/python .github/skills/greenroom-azure-alerts/references/verify-alert-payloads.py /Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T175116Z/payloads
shasum -a 256 -c /Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T175116Z/SHA256SUMS
```

The exact error was:

```text
Permission denied because no interactive user response was available. Retry in an interactive session so the user can approve it, or try an alternative that does not require this permission.
```

No alternative route was attempted. No successful venv creation, offline
verification, or checksum validation is claimed. These payloads are **not ready
to apply**. Full pre-write guards, including both Fired checks and the final
duplicate-run guard, were not reached. No Azure write or rollback occurred.

Read-back completed **17:51:52 UTC**: every writable property of all five rules
exactly matched both this backup's `.before.json` and the committed baseline.
All remain enabled; the log rule remains Sev 1, 5m/5m with its original query
and action group; the error metric retains `["5"]`. The processing-rule inventory
was empty (one page), and scheduled/metric inventories contained exactly one/four
rules without continuation. The provider was still Registered.
Live `attention.kql` returned zero rows with explicit API bounds
**17:21:48/17:51:48 UTC**.

No propagation or 15-minute post-apply evaluation wait ran: the combined rule
was never installed. Provisioning/query validation, evaluation health/history,
and real fired-email delivery/resolved-email suppression remain unverified.
Do not inject production failures. No rollback is needed and **no suppression
DELETE belongs to this attempt**, which created none. Any separately authorized
restoration must validate this backup and all guards, then restore its four
metric `.before.json` bodies in the rollback order below, followed by its
`log.before.json`; never substitute a different snapshot.
Provider registration need not be undone.

The recommendation at that time was to keep venvs and scratch files in the current session's `files/`, with only durable
backup evidence under `~/.george/greenroom-alert-backups/`. This remains the
recommended separation, not a permission guarantee. If a command is denied even
there, stop before writes; do not change trust settings, retry through another
execution route, or substitute CI's baseline verification for the fresh-backup
verifier. A future authorized apply requires fresh preparation and every guard.

## Earlier attempt: fresh backup captured; offline verifier blocked

On 2026-11-23 at **17:36:06 UTC**, read-only verification confirmed
`Microsoft.AlertsManagement` was already `Registered`; no registration request
was repeated. The processing-rule list API worked and its complete inventory
was empty. A new private durable backup was successfully captured by
**17:36:19 UTC** at:

`/Users/tyleonha/.george/greenroom-alert-backups/issue-241-20261123T173606Z`

Its root, `source/`, and `payloads/` directories have mode 0700. Raw source GETs,
generated apply/rollback bodies, and the SHA-256 manifest are retained there;
no earlier backup was accessed or changed.

The next command (isolated venv, dependency installation, offline verifier,
venv removal, then checksum validation) was denied by the execution environment:

```text
Permission denied because no interactive user response was available. Retry in an interactive session so the user can approve it, or try an alternative that does not require this permission.
```

No alternative route was attempted. Venv creation/removal cannot be confirmed,
and no successful offline verification or checksum validation is claimed.
The backup capture succeeded, but its generated payloads are **not verified
or ready to apply**. The full pre-apply guard sequence was not completed.
No processing-rule, scheduled-query, or metric-rule PUT was attempted.

Read-back completed **17:36:54 UTC**: every writable property of all five live
rules exactly matched this attempt's fresh `.before.json` bodies and the
committed original baseline. All remain enabled; the log rule remains Sev 1,
5m/5m with its original query/action group, and the error metric retains `["5"]`.
Suppression was absent (complete one-page list empty); the provider remained
Registered. Live read-only `attention.kql` returned no rows with explicit API
bounds **17:06:51/17:36:51 UTC**.

No rollback is needed. This attempt created no processing rule and must not
delete one. If separately authorized restoration ever becomes necessary, use
this attempt's originals only after checksum, quiet-state, and ownership checks:
restore the four metric `.before.json` bodies in the order below, then
`log.before.json`; no suppression DELETE belongs to this stopped attempt.
Never use an older or newly captured snapshot as its substitute. Alert rollback
does not require unregistering the provider.

No propagation/evaluation wait ran because the combined rule was not installed.
Its provisioning, query validation, evaluation health/history, real fired-email
delivery, and actual suppression of resolved emails remain unverified. Query
execution alone cannot establish rule health; notification behavior needs a real
incident, never an injected production failure.

## Earlier attempt: provider registered; backup preparation blocked

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

Run every command from the repository root on the #243 branch. Use only relative
local paths inside the checkout: one private `.alert-apply/` work directory,
a new timestamped backup, and the separate disposable `.alert-apply/venv/`.
The owner approved this deviation from retaining backups outside the repository.
Add `/.alert-apply/` to `.git/info/exclude` (local only, not `.gitignore`) before
capturing raw GETs, then confirm `git check-ignore .alert-apply/probe` succeeds.
Do not use symlinks, `cd`, subshells, or variables to reach outside the checkout.
Leave all older external backups untouched.

Never stage raw GETs: they contain creator metadata. Stage only explicit
documentation paths, never `git add .` or `git add -A`; confirm `git status --short`
and `git diff --cached --name-only` contain no `.alert-apply/` paths. Keep the
backup in this checkout afterwards, not in expiring session storage or CI
artifacts, and do not copy it elsewhere. Do not use a new snapshot when rolling
back an earlier apply. A relative path avoids the known external-path permission
trigger but does not guarantee permission: stop on any denial without attempting
another execution route or changing trust settings.

```bash
set -euo pipefail
umask 077
BACKUP=".alert-apply/backup-$(date -u '+%Y%m%dT%H%M%SZ')"
test ! -L .alert-apply
if test ! -d .alert-apply; then mkdir -m 700 .alert-apply; fi
chmod 700 .alert-apply
git check-ignore .alert-apply/probe
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

Before any write, run the fresh-backup verifier in the in-repository venv, then
validate the manifest. No CI baseline verification can replace this step.

```bash
python3 -m venv .alert-apply/venv
.alert-apply/venv/bin/pip install --quiet jsonschema
.alert-apply/venv/bin/python .github/skills/greenroom-azure-alerts/references/verify-alert-payloads.py "$BACKUP/payloads"
shasum -a 256 -c "$BACKUP/SHA256SUMS"
```

Stop on any error or permission denial, report the exact command and exact error,
and do not retry through another route. Remove only `.alert-apply/venv/` when
verification finishes or the apply stops; retain the backup. Confirm its absence.
Run the normal lint/typecheck/test/build commands with the backup present. If a
tool scans private evidence, use a local-only exclusion rather than committing
configuration specific to this checkout, and report it.

On the 18:11 attempt, normal `pnpm run lint` scanned the excluded backup despite
Biome's Git-ignore setting and failed formatting checks on its JSON. A small
`!.alert-apply` entry in Biome's `files.includes` now excludes this standardized
private operator directory without changing or formatting rollback evidence.
No other tool-specific exclusion was needed; retain the local Git exclude too.

## Apply — approval required; not yet completed

Keep the variable definitions from preparation. Before writing, verify checksums,
re-GET and compare all five live rules' writable properties with the saved
`.before.json` files, and recheck all processing-rule pages for the reserved name.
Stop on drift, authentication failure, incomplete pagination, or an active incident.
Review all currently Fired alerts in Azure Monitor, including older incidents.
The subscription alerts API's default time range must not silently narrow that check.
Use both the paginated 30-day check and an unbounded current-state check, including
older active incidents. Immediately before the first write, reread issue #241's
latest comments and recheck all five live bodies and every processing-rule page.
If any rule differs from this apply's `.before.json`, or the suppression name now
exists, stop: another operator may be mid-apply. Never overwrite or adopt its rule.

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
