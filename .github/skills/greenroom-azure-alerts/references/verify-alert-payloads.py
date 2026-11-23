"""CI-only offline verification. Downloads public schemas, never calls Azure."""

import copy
import json
import sys
import urllib.request
from pathlib import Path

from jsonschema import Draft4Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT4

output = Path(sys.argv[1])
snapshot = json.loads((output / "snapshot.json").read_text())
base = "https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/specification/"
urls = {
    "log": base + "monitor/resource-manager/Microsoft.Insights/Insights/stable/"
    "2023-12-01/scheduledQueryRule_API.json",
    "metric": base + "monitor/resource-manager/Microsoft.Insights/Insights/stable/"
    "2018-03-01/metricAlert_API.json",
    "processing": base + "alertsmanagement/resource-manager/Microsoft.AlertsManagement/"
    "AlertProcessingRules/stable/2021-08-08/AlertProcessingRules.json",
    "common": base + "common-types/resource-management/v3/types.json",
}
schemas = {}
for name, url in urls.items():
    with urllib.request.urlopen(url, timeout=30) as response:
        schemas[name] = json.load(response)
    (output / f"{name}.schema.json").write_text(json.dumps(schemas[name], indent=2) + "\n")

# Swagger's discriminator extends this base with typed subtype fields. Plain
# JSON Schema cannot model that extension: allow those fields at the base,
# then explicitly validate each concrete subtype against its original schema.
for model in ("MetricAlertCriteria", "MultiMetricCriteria"):
    schemas["metric"]["definitions"][model].pop("additionalProperties", None)
registry = Registry().with_resources(
    (urls[name], Resource.from_contents(schema, default_specification=DRAFT4))
    for name, schema in schemas.items()
)


def validate(schema_name, model, body):
    Draft4Validator(
        {"$ref": f"{urls[schema_name]}#/definitions/{model}"}, registry=registry
    ).validate(body)


def load(name):
    return json.loads((output / name).read_text())


def request_body(original, log=False):
    allowed = ("location", "tags", "properties", "identity", "kind") if log else (
        "location", "tags", "properties"
    )
    body = {key: copy.deepcopy(value) for key, value in original.items() if key in allowed}
    if log:
        for key in ("createdWithApiVersion", "isLegacyLogAnalyticsRule", "isWorkspaceAlertsStorageConfigured"):
            body["properties"].pop(key, None)
    return body


for original in snapshot["metrics"]["value"]:
    name = original["name"]
    before = load(f"{name}.before.json")
    after = load(f"{name}.after.json")
    assert load(f"{name}.original.json") == original
    assert before == request_body(original), f"{name}: rollback changed writable configuration"
    expected = copy.deepcopy(before)
    expected["properties"]["enabled"] = False
    if name == "mycalltime-high-error-rate":
        expected["properties"]["criteria"]["allOf"][0]["dimensions"] = [{
            "name": "request/resultCode", "operator": "Include",
            "values": [str(code) for code in range(500, 600)],
        }]
    assert after == expected, f"{name}: unexpected apply changes"
    subtype = "WebtestLocationAvailabilityCriteria" if name == "mycalltime-availability-alert" else (
        "MetricAlertSingleResourceMultipleMetricCriteria"
    )
    for body in (before, after):
        validate("metric", "MetricAlertResource", body)
        validate("metric", subtype, body["properties"]["criteria"])
        if subtype != "WebtestLocationAvailabilityCriteria":
            validate("metric", "MetricCriteria", body["properties"]["criteria"]["allOf"][0])

original = snapshot["scheduled"]
before = load("log.before.json")
after = load("log.after.json")
assert load("log.original.json") == original
assert before == request_body(original, log=True)
expected = copy.deepcopy(before)
expected["properties"].update({
    "displayName": "My Call Time needs attention",
    "description": "Sustained multi-location outage, persistent 5xx, or missing synthetic telemetry. "
    "Investigate; brief self-healing replacements do not page.",
    "severity": 2, "enabled": True, "evaluationFrequency": "PT5M",
    "windowSize": "PT15M", "autoMitigate": True, "skipQueryValidation": False,
    "criteria": {"allOf": [{
        "query": Path(__file__).with_name("attention.kql").read_text(),
        "timeAggregation": "Count", "operator": "GreaterThan", "threshold": 0,
        "dimensions": [], "failingPeriods": {
            "numberOfEvaluationPeriods": 1, "minFailingPeriodsToAlert": 1,
        },
    }]},
})
assert after == expected, "Unexpected scheduled-query apply changes"
for body in (before, after):
    validate("log", "ScheduledQueryRuleResource", body)

suppression = load("recovery-suppression.json")
validate("processing", "AlertProcessingRule", suppression)
validate("processing", "RemoveAllActionGroups", suppression["properties"]["actions"][0])
assert suppression == {
    "location": "global",
    "properties": {
        "enabled": True,
        "description": "Suppress only recovery notifications for the My Call Time attention alert",
        "scopes": original["properties"]["scopes"],
        "conditions": [
            {"field": "AlertRuleId", "operator": "Equals", "values": [original["id"]]},
            {"field": "MonitorCondition", "operator": "Equals", "values": ["Resolved"]},
        ],
        "actions": [{"actionType": "RemoveAllActionGroups"}],
    },
}
assert not snapshot["actionRules"].get("nextLink")
assert all(rule["name"] != "mycalltime-attention-no-recovery" for rule in snapshot["actionRules"]["value"])

print("PASS: all 11 apply/rollback bodies match the versioned REST request schemas.")
print("PASS: apply changes only reviewed settings; 5xx strings are exactly 500..599.")
print("PASS: rollback preserves every current writable property, including the original ['5'] filter.")
print("PASS: suppression matches only the exact rule AND Resolved; it was absent in the snapshot.")
print("No Azure writes, deployments, or mutation-based validation calls were made.")
