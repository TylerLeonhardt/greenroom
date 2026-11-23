import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const reference = ".github/skills/greenroom-azure-alerts/references";

function fixture(t) {
	fs.mkdirSync(".alert-apply", { recursive: true, mode: 0o700 });
	const directory = fs.mkdtempSync(".alert-apply/equivalence-test-");
	t.after(() => fs.rmSync(directory, { recursive: true }));
	execFileSync(
		process.execPath,
		[
			`${reference}/build-alert-payloads.mjs`,
			`${reference}/snapshot-2026-11-23.json`,
			`${directory}/fresh`,
		],
		{ stdio: "pipe" },
	);
	fs.cpSync(`${directory}/fresh`, `${directory}/reference`, { recursive: true });
	fs.cpSync(`${directory}/fresh`, `${directory}/artifact`, { recursive: true });
	return {
		directory,
		run: () =>
			spawnSync(
				process.execPath,
				[
					`${reference}/compare-alert-payloads.mjs`,
					`${directory}/fresh`,
					`${directory}/reference`,
					`${directory}/artifact`,
				],
				{ encoding: "utf8" },
			),
	};
}

test("compares JSON deeply, ignoring key order and known CI supporting files", (t) => {
	const { directory, run } = fixture(t);
	const file = `${directory}/artifact/log.after.json`;
	const body = JSON.parse(fs.readFileSync(file, "utf8"));
	fs.writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(body).reverse())));
	fs.writeFileSync(`${directory}/artifact/log.schema.json`, "{}");
	const result = run();
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /all eleven/);
});

test("rejects a nested property difference in either reference set with its exact path", (t) => {
	const { directory, run } = fixture(t);
	for (const set of ["reference", "artifact"]) {
		const file = `${directory}/${set}/log.after.json`;
		const original = fs.readFileSync(file, "utf8");
		const body = JSON.parse(original);
		body.properties.severity = 1;
		fs.writeFileSync(file, JSON.stringify(body));
		const result = run();
		assert.notEqual(result.status, 0);
		assert.ok(
			result.stderr.includes('["properties"]["severity"]: fresh=2 reference=1'),
			result.stderr,
		);
		fs.writeFileSync(file, original);
	}
});

test("rejects missing and extra bodies even when all sets have the same file list", (t) => {
	const { directory, run } = fixture(t);
	for (const set of ["fresh", "reference", "artifact"]) {
		fs.renameSync(`${directory}/${set}/log.before.json`, `${directory}/${set}/unexpected.json`);
	}
	const result = run();
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /missing\/extra request-body files/);
});

test("rejects extra properties and reordered arrays", (t) => {
	const { directory, run } = fixture(t);
	const file = `${directory}/fresh/recovery-suppression.json`;
	const original = fs.readFileSync(file, "utf8");
	const body = JSON.parse(original);
	body.properties.extra = false;
	fs.writeFileSync(file, JSON.stringify(body));
	assert.match(run().stderr, /extra in fresh/);
	delete body.properties.extra;
	body.properties.conditions.reverse();
	fs.writeFileSync(file, JSON.stringify(body));
	assert.notEqual(run().status, 0);
});

test("rejects a request-body symlink rather than following it", (t) => {
	const { directory, run } = fixture(t);
	const file = `${directory}/fresh/log.after.json`;
	fs.unlinkSync(file);
	fs.symlinkSync(path.join("..", "reference", "log.after.json"), file);
	const result = run();
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /not a file/);
});
