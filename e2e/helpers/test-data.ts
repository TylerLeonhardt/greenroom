import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const APP_PROJECTS = ["Desktop Chrome", "Mobile Safari", "Mobile Chrome"] as const;

export type AppProjectName = (typeof APP_PROJECTS)[number];
export type AuthRole = "admin" | "member" | "solo";

export interface SharedTestData {
	admin: { id: string; email: string; name: string };
	member: { id: string; email: string; name: string };
	solo: { id: string; email: string; name: string };
	group: { id: string; name: string; inviteCode: string };
	availabilityRequest: { id: string; title: string; dates: string[] };
	creatorAvailabilityRequest: { id: string; title: string; dates: string[] };
	eventPermissionGroup: { id: string; name: string; inviteCode: string };
	permissionAvailabilityRequest: { id: string; title: string; dates: string[] };
	permissionCreatorAvailabilityRequest: { id: string; title: string; dates: string[] };
}

/**
 * Resolves project-specific files saved by global.setup.ts. Specs access these
 * through helpers/fixtures.ts after the setup dependency has completed.
 */
function projectSlug(projectName: string): string {
	if (!APP_PROJECTS.includes(projectName as AppProjectName)) {
		throw new Error(`Unknown app E2E project: ${projectName}`);
	}

	return projectName.toLowerCase().replaceAll(" ", "-");
}

function runId(): string {
	const id = process.env.E2E_RUN_ID;
	if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
		throw new Error("E2E_RUN_ID must be set to an alphanumeric or hyphenated value");
	}
	return id;
}

export function testNamespace(projectName: string): string {
	return `${runId()}-${projectSlug(projectName)}`;
}

export function testArtifactsPath(): string {
	return path.join(os.tmpdir(), "greenroom-e2e", runId());
}

export function authStatePath(projectName: string, role: AuthRole): string {
	return path.join(testArtifactsPath(), `${projectSlug(projectName)}-${role}.json`);
}

export function projectIp(projectName: string): string {
	const digest = createHash("sha256")
		.update(`${runId()}:${projectSlug(projectName)}`)
		.digest("hex")
		.slice(0, 16);
	const segments = digest.match(/.{4}/g);
	if (!segments) {
		throw new Error("Unable to generate an E2E project IP");
	}
	return `2001:db8:${segments.join(":")}`;
}

export function testDataPath(projectName: string): string {
	return path.join(testArtifactsPath(), `${projectSlug(projectName)}-test-data.json`);
}

export function loadTestData(projectName: string): SharedTestData {
	const path = testDataPath(projectName);
	if (!fs.existsSync(path)) {
		throw new Error(`Missing E2E test data for ${projectName}: ${path}`);
	}
	const raw = fs.readFileSync(path, "utf-8");
	return JSON.parse(raw);
}
