import { beforeEach, describe, expect, it, vi } from "vitest";

describe("telemetry.server", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllEnvs();
	});

	it("returns null client when APPLICATIONINSIGHTS_CONNECTION_STRING is not set", async () => {
		vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "");
		const { getTelemetryClient } = await import("./telemetry.server");
		expect(getTelemetryClient()).toBeNull();
	});

	it("returns null client when env var is undefined", async () => {
		delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
		const { getTelemetryClient } = await import("./telemetry.server");
		expect(getTelemetryClient()).toBeNull();
	});
});
