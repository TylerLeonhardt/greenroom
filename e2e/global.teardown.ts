import fs from "node:fs";
import { cleanupTestNamespace } from "./helpers/seed";
import { APP_PROJECTS, authStatePath, testDataPath, testNamespace } from "./helpers/test-data";

export default async function globalTeardown(): Promise<void> {
	for (const projectName of APP_PROJECTS) {
		const dataPath = testDataPath(projectName);
		if (!fs.existsSync(dataPath)) continue;

		await cleanupTestNamespace(testNamespace(projectName));
		for (const role of ["admin", "member", "solo"] as const) {
			fs.rmSync(authStatePath(projectName, role), { force: true });
		}
		fs.rmSync(dataPath, { force: true });
	}
}
