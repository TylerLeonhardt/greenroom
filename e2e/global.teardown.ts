import fs from "node:fs";
import { cleanupTestNamespace } from "./helpers/seed";
import { APP_PROJECTS, authStatePath, testDataPath, testNamespace } from "./helpers/test-data";

export default async function globalTeardown(): Promise<void> {
	const cleanupErrors: unknown[] = [];

	for (const projectName of APP_PROJECTS) {
		const dataPath = testDataPath(projectName);
		if (!fs.existsSync(dataPath)) continue;

		try {
			await cleanupTestNamespace(testNamespace(projectName));
			fs.rmSync(dataPath, { force: true });
		} catch (error) {
			cleanupErrors.push(error);
		} finally {
			for (const role of ["admin", "member", "solo"] as const) {
				fs.rmSync(authStatePath(projectName, role), { force: true });
			}
		}
	}

	if (cleanupErrors.length > 0) {
		throw new AggregateError(cleanupErrors, "Failed to clean one or more E2E project namespaces");
	}
}
