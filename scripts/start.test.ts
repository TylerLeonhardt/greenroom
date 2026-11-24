import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function runStartup(migrationExitCode: number) {
	const directory = mkdtempSync(path.join(tmpdir(), "greenroom-start-"));
	temporaryDirectories.push(directory);
	const calls = path.join(directory, "calls");
	writeFileSync(
		path.join(directory, "node"),
		`#!/bin/sh
printf '%s\\n' "$*" >> "$STARTUP_CALLS"
if [ "$1" = "scripts/migrate.mjs" ]; then
	exit "$MIGRATION_EXIT_CODE"
fi
printf '%s' "$PPID" > "$SERVER_PARENT"
`,
		{ mode: 0o755 },
	);
	const result = spawnSync("/bin/sh", ["scripts/start.sh"], {
		encoding: "utf8",
		env: {
			...process.env,
			PATH: directory,
			STARTUP_CALLS: calls,
			MIGRATION_EXIT_CODE: String(migrationExitCode),
			SERVER_PARENT: path.join(directory, "parent"),
		},
	});
	return {
		result,
		calls: readFileSync(calls, "utf8").trim().split("\n"),
		directory,
	};
}

describe("container startup", () => {
	it("runs migrations before starting the server without a package manager or wrapper process", () => {
		const { result, calls, directory } = runStartup(0);
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(calls).toEqual([
			"scripts/migrate.mjs",
			"node_modules/@remix-run/serve/dist/cli.js ./build/server/index.js",
		]);
		expect(Number(readFileSync(path.join(directory, "parent"), "utf8"))).toBe(process.pid);
	});

	it("does not start the server if migrations fail", () => {
		const { result, calls } = runStartup(7);
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(7);
		expect(calls).toEqual(["scripts/migrate.mjs"]);
	});
});
