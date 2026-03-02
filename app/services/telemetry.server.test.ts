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

	it("trackEvent is a no-op when client is null", async () => {
		vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "");
		const { trackEvent } = await import("./telemetry.server");
		// Should not throw
		expect(() => trackEvent("TestEvent", { key: "value" })).not.toThrow();
	});

	it("trackEvent calls client.trackEvent when client is available", async () => {
		const mockTrackEvent = vi.fn();
		vi.doMock("applicationinsights", () => ({
			default: {
				setup: vi.fn().mockReturnValue({
					setAutoCollectRequests: vi.fn().mockReturnValue({
						setAutoCollectExceptions: vi.fn().mockReturnValue({
							setAutoCollectDependencies: vi.fn().mockReturnValue({
								setAutoCollectPerformance: vi.fn().mockReturnValue({
									setSendLiveMetrics: vi.fn().mockReturnValue({
										start: vi.fn(),
									}),
								}),
							}),
						}),
					}),
				}),
				defaultClient: {
					trackEvent: mockTrackEvent,
					context: { tags: {}, keys: { cloudRole: "cloudRole" } },
				},
			},
		}));

		vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "InstrumentationKey=test-key");
		const { trackEvent } = await import("./telemetry.server");

		trackEvent("UserCreated", { method: "email" });
		expect(mockTrackEvent).toHaveBeenCalledWith({
			name: "UserCreated",
			properties: { method: "email" },
		});
	});
});
