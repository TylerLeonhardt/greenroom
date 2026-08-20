import { beforeEach, describe, expect, it, vi } from "vitest";

describe("redactSensitiveUrls", () => {
	it("redacts magic-link tokens", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("/auth/magic-link/consume?token=LIVE")).toBe(
			"/auth/magic-link/consume?token=[REDACTED]",
		);
	});

	it("redacts email-verification tokens", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("/verify-email?token=LIVE")).toBe("/verify-email?token=[REDACTED]");
	});

	it("redacts tokens in any query-string position", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("/verify-email?a=1&token=LIVE&b=2")).toBe(
			"/verify-email?a=1&token=[REDACTED]&b=2",
		);
	});

	it("redacts token keys case-insensitively", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("/verify-email?ToKeN=LIVE")).toBe("/verify-email?ToKeN=[REDACTED]");
	});

	it("redacts URL-encoded token values", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("/verify-email?token=LIVE%2FSECRET%3D%3D")).toBe(
			"/verify-email?token=[REDACTED]",
		);
	});

	it("preserves harmless redirect query parameters", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		const url = "/auth/magic-link/consume?next=%2Fdashboard&redirectTo=%2Fgroups%2F123";
		expect(redactSensitiveUrls(url)).toBe(url);
	});

	it("redacts calendar feed token from a full URL", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("https://mycalltime.app/api/calendar/abc123TOKEN.ics")).toBe(
			"https://mycalltime.app/api/calendar/[REDACTED].ics",
		);
	});

	it("redacts calendar feed token from a path-only URL", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("/api/calendar/abc123TOKEN.ics")).toBe(
			"/api/calendar/[REDACTED].ics",
		);
	});

	it("redacts calendar token from request name with HTTP method prefix", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("GET /api/calendar/secretToken99.ics")).toBe(
			"GET /api/calendar/[REDACTED].ics",
		);
	});

	it("does not modify URLs that don't contain calendar tokens", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("/api/health")).toBe("/api/health");
		expect(redactSensitiveUrls("/groups/123/events")).toBe("/groups/123/events");
	});

	it("redacts Discord webhook URLs (discord.com)", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("https://discord.com/api/webhooks/123456789/abcDEF_token")).toBe(
			"https://discord.com/api/webhooks/[REDACTED]/[REDACTED]",
		);
	});

	it("redacts Discord webhook URLs (discordapp.com)", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("https://discordapp.com/api/webhooks/999/xyzTOKEN123")).toBe(
			"https://discord.com/api/webhooks/[REDACTED]/[REDACTED]",
		);
	});

	it("redacts multiple sensitive URLs in one string", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		const input = "Ref: /api/calendar/t1.ics and https://discord.com/api/webhooks/1/tok";
		const result = redactSensitiveUrls(input);
		expect(result).toContain("/api/calendar/[REDACTED].ics");
		expect(result).toContain("https://discord.com/api/webhooks/[REDACTED]/[REDACTED]");
		expect(result).not.toContain("t1");
		expect(result).not.toContain("tok");
	});

	it("handles empty strings", async () => {
		const { redactSensitiveUrls } = await import("./telemetry.server");
		expect(redactSensitiveUrls("")).toBe("");
	});
});

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

	it("registers telemetry processors for URL redaction and client-error success override", async () => {
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

		expect(processors).toHaveLength(2);
	});

	describe("URL redaction processor", () => {
		let processor: (envelope: unknown) => boolean;

		beforeEach(async () => {
			vi.resetModules();
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
						addTelemetryProcessor: vi.fn((fn: (envelope: unknown) => boolean) =>
							processors.push(fn),
						),
						context: { tags: {}, keys: { cloudRole: "cloudRole" } },
					},
				},
			}));

			vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "InstrumentationKey=test-key");
			await import("./telemetry.server");
			processor = processors[0];
		});

		it("redacts calendar token from request URL", () => {
			const envelope = {
				data: {
					baseData: {
						url: "https://mycalltime.app/api/calendar/secret-token-123.ics",
						name: "GET /api/calendar/secret-token-123.ics",
					},
				},
			};
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.url).toBe("https://mycalltime.app/api/calendar/[REDACTED].ics");
			expect(envelope.data.baseData.name).toBe("GET /api/calendar/[REDACTED].ics");
		});

		it("redacts Discord webhook URL from dependency data", () => {
			const envelope = {
				data: {
					baseData: {
						data: "https://discord.com/api/webhooks/123456789/webhookToken",
						name: "POST https://discord.com/api/webhooks/123456789/webhookToken",
					},
				},
			};
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.data).toBe(
				"https://discord.com/api/webhooks/[REDACTED]/[REDACTED]",
			);
			expect(envelope.data.baseData.name).toBe(
				"POST https://discord.com/api/webhooks/[REDACTED]/[REDACTED]",
			);
		});

		it("redacts auth tokens from request URL, name, and dependency data", () => {
			const envelope = {
				data: {
					baseData: {
						url: "https://mycalltime.app/verify-email?token=request-secret",
						name: "GET /auth/magic-link/consume?token=name-secret",
						data: "https://mycalltime.app/verify-email?token=dependency-secret",
					},
				},
			};
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.url).toBe(
				"https://mycalltime.app/verify-email?token=[REDACTED]",
			);
			expect(envelope.data.baseData.name).toBe("GET /auth/magic-link/consume?token=[REDACTED]");
			expect(envelope.data.baseData.data).toBe(
				"https://mycalltime.app/verify-email?token=[REDACTED]",
			);
		});

		it("does not modify non-sensitive URLs", () => {
			const envelope = {
				data: { baseData: { url: "/dashboard", name: "GET /dashboard" } },
			};
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.url).toBe("/dashboard");
			expect(envelope.data.baseData.name).toBe("GET /dashboard");
		});

		it("handles envelope without baseData", () => {
			const envelope = { data: {} };
			expect(processor(envelope)).toBe(true);
		});

		it("handles non-string fields gracefully", () => {
			const envelope = { data: { baseData: { url: 12345, name: null } } };
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.url).toBe(12345);
			expect(envelope.data.baseData.name).toBeNull();
		});
	});

	describe("client-error success override processor", () => {
		let processor: (envelope: unknown) => boolean;

		beforeEach(async () => {
			vi.resetModules();
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
						addTelemetryProcessor: vi.fn((fn: (envelope: unknown) => boolean) =>
							processors.push(fn),
						),
						context: { tags: {}, keys: { cloudRole: "cloudRole" } },
					},
				},
			}));

			vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "InstrumentationKey=test-key");
			await import("./telemetry.server");
			processor = processors[1];
		});

		it("marks 404 as successful", () => {
			const envelope = {
				data: { baseData: { responseCode: "404", success: false } },
			};
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.success).toBe(true);
		});

		it("marks 429 as successful", () => {
			const envelope = {
				data: { baseData: { responseCode: "429", success: false } },
			};
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.success).toBe(true);
		});

		it("does not mark 500 as successful", () => {
			const envelope = {
				data: { baseData: { responseCode: "500", success: false } },
			};
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.success).toBe(false);
		});

		it("keeps 200 as successful", () => {
			const envelope = {
				data: { baseData: { responseCode: "200", success: true } },
			};
			expect(processor(envelope)).toBe(true);
			expect(envelope.data.baseData.success).toBe(true);
		});

		it("handles envelope without baseData", () => {
			const envelope = { data: {} };
			expect(processor(envelope)).toBe(true);
		});
	});
});
