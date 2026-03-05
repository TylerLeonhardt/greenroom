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
					addTelemetryProcessor: vi.fn(),
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

	it("registers a telemetry processor that marks 404s as successful", async () => {
		const processors: Array<(envelope: unknown) => boolean> = [];
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
					trackEvent: vi.fn(),
					addTelemetryProcessor: vi.fn((fn: (envelope: unknown) => boolean) => processors.push(fn)),
					context: { tags: {}, keys: { cloudRole: "cloudRole" } },
				},
			},
		}));

		vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "InstrumentationKey=test-key");
		await import("./telemetry.server");

		expect(processors).toHaveLength(1);
		const processor = processors[0];

		// 404 request should be marked as successful
		const envelope404 = {
			data: { baseData: { responseCode: "404", success: false } },
		};
		expect(processor(envelope404)).toBe(true);
		expect(envelope404.data.baseData.success).toBe(true);

		// 500 request should remain unchanged
		const envelope500 = {
			data: { baseData: { responseCode: "500", success: false } },
		};
		expect(processor(envelope500)).toBe(true);
		expect(envelope500.data.baseData.success).toBe(false);

		// 200 request should remain unchanged
		const envelope200 = {
			data: { baseData: { responseCode: "200", success: true } },
		};
		expect(processor(envelope200)).toBe(true);
		expect(envelope200.data.baseData.success).toBe(true);

		// Envelope without baseData should not crash
		const envelopeEmpty = { data: {} };
		expect(processor(envelopeEmpty)).toBe(true);
	});
});
