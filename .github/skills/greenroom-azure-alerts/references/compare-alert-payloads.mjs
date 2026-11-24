import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const directories = process.argv.slice(2);
assert.equal(
	directories.length,
	3,
	"Usage: node compare-alert-payloads.mjs FRESH REFERENCE CI_ARTIFACT",
);
const expected = [
	"log.after.json",
	"log.before.json",
	...[
		"mycalltime-app-unhealthy",
		"mycalltime-availability-alert",
		"mycalltime-high-error-rate",
		"mycalltime-slow-response",
	].flatMap((name) => [`${name}.after.json`, `${name}.before.json`]),
	"recovery-suppression.json",
].sort();
const supporting = new Set([
	"snapshot.json",
	"log.original.json",
	...expected
		.filter((name) => name.endsWith(".before.json"))
		.map((name) => name.replace(".before.json", ".original.json")),
	...["log", "metric", "processing", "common"].map((name) => `${name}.schema.json`),
]);

function firstDifference(actual, reference, pointer = "$") {
	if (isDeepStrictEqual(actual, reference)) return undefined;
	if (
		actual === null ||
		reference === null ||
		typeof actual !== "object" ||
		typeof reference !== "object" ||
		Array.isArray(actual) !== Array.isArray(reference)
	) {
		return `${pointer}: fresh=${JSON.stringify(actual)} reference=${JSON.stringify(reference)}`;
	}
	for (const key of new Set([...Object.keys(actual), ...Object.keys(reference)])) {
		const location = `${pointer}[${JSON.stringify(key)}]`;
		if (!Object.hasOwn(actual, key)) return `${location}: missing in fresh`;
		if (!Object.hasOwn(reference, key)) return `${location}: extra in fresh`;
		const difference = firstDifference(actual[key], reference[key], location);
		if (difference) return difference;
	}
	return `${pointer}: different array length`;
}

for (const directory of directories) {
	assert.ok(
		!path.isAbsolute(directory) && !directory.split(/[\\/]/).includes(".."),
		`Use a repository-relative path: ${directory}`,
	);
	let current = "";
	for (const segment of directory.split("/").filter(Boolean)) {
		current = path.join(current, segment);
		assert.ok(!fs.lstatSync(current).isSymbolicLink(), `Symlink forbidden: ${current}`);
	}
	const files = fs.readdirSync(directory);
	for (const name of files) {
		assert.ok(
			fs.lstatSync(path.join(directory, name)).isFile(),
			`${directory}/${name}: not a file`,
		);
	}
	const bodies = files.filter((name) => !supporting.has(name));
	assert.deepEqual(bodies.sort(), expected, `${directory}: missing/extra request-body files`);
}
for (const name of expected) {
	const fresh = JSON.parse(fs.readFileSync(path.join(directories[0], name), "utf8"));
	for (const directory of directories.slice(1)) {
		const reference = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
		const difference = firstDifference(fresh, reference);
		assert.ok(!difference, `${name} vs ${directory}: ${difference}`);
	}
}
console.log("PASS: all eleven fresh request bodies deeply equal the reference and CI artifact.");
console.log(
	"This checks equivalence only; verify exact-head CI provenance and checksums separately.",
);
