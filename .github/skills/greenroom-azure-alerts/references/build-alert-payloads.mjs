import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Offline only. Input must be a saved, freshly reviewed read-only Azure snapshot.
const [snapshotFile, output] = process.argv.slice(2);
assert.ok(snapshotFile && output, "Usage: node build-alert-payloads.mjs SNAPSHOT OUTPUT_DIRECTORY");
const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
const query = fs.readFileSync(new URL("./attention.kql", import.meta.url), "utf8");
const log = snapshot.scheduled;
const metrics = snapshot.metrics.value;
assert.ok(!snapshot.metrics.nextLink && !snapshot.actionRules.nextLink, "Finish pagination first");
assert.deepEqual(
	metrics.map((rule) => rule.name).sort(),
	[
		"mycalltime-app-unhealthy",
		"mycalltime-availability-alert",
		"mycalltime-high-error-rate",
		"mycalltime-slow-response",
	],
);
assert.equal(log.name, "mycalltime-exception-spike");
assert.ok(
	snapshot.actionRules.value.every(
		(rule) => rule.name.toLowerCase() !== "mycalltime-attention-no-recovery",
	),
	"Recovery suppression already exists: do not overwrite or delete it",
);
assert.ok(
	[log, ...metrics].every(
		(rule) =>
			rule.id.toLowerCase().startsWith(
				"/subscriptions/b37965f1-4da2-4202-889d-82322392b4d5/resourcegroups/greenroom-rg/",
			) && rule.properties.enabled === true,
	),
	"Unexpected subscription, resource group, or enabled state: re-review the proposal",
);
fs.mkdirSync(output);

function save(name, value) {
	fs.writeFileSync(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`, {
		flag: "wx",
		mode: 0o600,
	});
}

function requestBody(original, allowed) {
	return structuredClone(
		Object.fromEntries(Object.entries(original).filter(([key]) => allowed.includes(key))),
	);
}

for (const rule of metrics) {
	save(`${rule.name}.original.json`, rule);
	const before = requestBody(rule, ["location", "tags", "properties"]);
	save(`${rule.name}.before.json`, before);
	const after = structuredClone(before);
	after.properties.enabled = false;
	if (rule.name === "mycalltime-high-error-rate") {
		after.properties.criteria.allOf[0].dimensions = [
			{
				name: "request/resultCode",
				operator: "Include",
				values: Array.from({ length: 100 }, (_, index) => String(500 + index)),
			},
		];
	}
	save(`${rule.name}.after.json`, after);
}

save("log.original.json", log);
const before = requestBody(log, ["location", "tags", "identity", "kind", "properties"]);
for (const key of [
	"createdWithApiVersion",
	"isLegacyLogAnalyticsRule",
	"isWorkspaceAlertsStorageConfigured",
]) {
	delete before.properties[key];
}
save("log.before.json", before);
const after = structuredClone(before);
Object.assign(after.properties, {
	displayName: "My Call Time needs attention",
	description:
		"Sustained multi-location outage, persistent 5xx, or missing synthetic telemetry. Investigate; brief self-healing replacements do not page.",
	severity: 2,
	enabled: true,
	evaluationFrequency: "PT5M",
	windowSize: "PT15M",
	autoMitigate: true,
	skipQueryValidation: false,
	criteria: {
		allOf: [
			{
				query,
				timeAggregation: "Count",
				operator: "GreaterThan",
				threshold: 0,
				dimensions: [],
				failingPeriods: { numberOfEvaluationPeriods: 1, minFailingPeriodsToAlert: 1 },
			},
		],
	},
});
save("log.after.json", after);
save("recovery-suppression.json", {
	location: "global",
	properties: {
		enabled: true,
		description: "Suppress only recovery notifications for the My Call Time attention alert",
		scopes: log.properties.scopes,
		conditions: [
			{ field: "AlertRuleId", operator: "Equals", values: [log.id] },
			{ field: "MonitorCondition", operator: "Equals", values: ["Resolved"] },
		],
		actions: [{ actionType: "RemoveAllActionGroups" }],
	},
});
save("snapshot.json", snapshot);
console.log(`Prepared apply/rollback bodies in ${path.resolve(output)}; no Azure writes.`);
console.log(`Query source: ${fileURLToPath(new URL("./attention.kql", import.meta.url))}`);
