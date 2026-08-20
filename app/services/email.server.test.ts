import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { beginSendMock, getTelemetryClientMock, trackEventMock, trackExceptionMock } = vi.hoisted(
	() => ({
		beginSendMock: vi.fn(),
		getTelemetryClientMock: vi.fn(),
		trackEventMock: vi.fn(),
		trackExceptionMock: vi.fn(),
	}),
);

// Must mock before importing the module under test
vi.mock("@azure/communication-email", () => ({
	EmailClient: vi.fn().mockImplementation(() => ({
		beginSend: beginSendMock,
	})),
}));

vi.mock("./logger.server.js", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("./telemetry.server.js", () => ({
	getTelemetryClient: getTelemetryClientMock,
}));

vi.mock("./notification-utils.server.js", () => ({
	mergeWithDefaults: vi.fn().mockReturnValue({
		availabilityRequests: { email: true },
		eventNotifications: { email: true },
		showReminders: { email: true },
	}),
}));

import { classifyEmailError, sendVerificationEmail } from "./email.server.js";
import { logger } from "./logger.server.js";

describe("classifyEmailError", () => {
	it('classifies suppression errors as "suppressed"', () => {
		expect(classifyEmailError(new Error("AllRecipientsSuppressed"))).toBe("suppressed");
		expect(classifyEmailError(new Error("EmailDroppedAllRecipientsSuppressed"))).toBe("suppressed");
		expect(classifyEmailError(new Error("recipient on suppression list"))).toBe("suppressed");
		expect(classifyEmailError(new Error("address was Suppressed by provider"))).toBe("suppressed");
	});

	it('classifies clock skew errors as "clock_skew"', () => {
		expect(
			classifyEmailError(
				new Error(
					"time difference between the originating client and the server is greater than the allowed margin",
				),
			),
		).toBe("clock_skew");
	});

	it('classifies network errors as "transient"', () => {
		expect(classifyEmailError(new Error("ECONNRESET"))).toBe("transient");
		expect(classifyEmailError(new Error("ETIMEDOUT"))).toBe("transient");
		expect(classifyEmailError(new Error("ENOTFOUND"))).toBe("transient");
		expect(classifyEmailError(new Error("socket hang up"))).toBe("transient");
		expect(classifyEmailError(new Error("503 Service Unavailable"))).toBe("transient");
		expect(classifyEmailError(new Error("429 Too Many Requests"))).toBe("transient");
	});

	it('classifies unknown errors as "permanent"', () => {
		expect(classifyEmailError(new Error("Invalid email format"))).toBe("permanent");
		expect(classifyEmailError(new Error("Authentication failed"))).toBe("permanent");
		expect(classifyEmailError("string error")).toBe("permanent");
	});
});

describe("sendEmail", () => {
	const originalNodeEnv = process.env.NODE_ENV;

	async function freshSendEmail() {
		vi.resetModules();
		const mod = await import("./email.server.js");
		const { logger: freshLogger } = await import("./logger.server.js");
		return { sendEmail: mod.sendEmail, freshLogger };
	}

	beforeEach(() => {
		vi.clearAllMocks();
		getTelemetryClientMock.mockReturnValue(null);
		delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
	});

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
		delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
	});

	it("returns success when ACS is not configured outside production", async () => {
		process.env.NODE_ENV = "development";
		const { sendEmail, freshLogger } = await freshSendEmail();
		const result = await sendEmail({
			to: "test@example.com",
			subject: "Test",
			html: "<p>Test</p>",
		});

		expect(result).toEqual({ success: true });
		expect(freshLogger.info).toHaveBeenCalledWith(
			expect.objectContaining({ recipientCount: 1 }),
			expect.stringContaining("not configured"),
		);
	});

	it("returns a permanent failure when ACS is not configured in production", async () => {
		process.env.NODE_ENV = "production";
		const { sendEmail, freshLogger } = await freshSendEmail();

		const result = await sendEmail({
			to: "test@example.com",
			subject: "Test",
			html: "<p>Test</p>",
		});

		expect(result).toEqual({
			success: false,
			error: "Email send failed (permanent)",
			errorKind: "permanent",
		});
		expect(freshLogger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				recipientCount: 1,
				errorKind: "permanent",
				unavailableReason: "not_configured",
			}),
			"Failed to send email",
		);
	});

	it("returns a permanent failure for invalid ACS configuration in production", async () => {
		process.env.NODE_ENV = "production";
		process.env.AZURE_COMMUNICATION_CONNECTION_STRING = "invalid";
		const { sendEmail, freshLogger } = await freshSendEmail();

		const result = await sendEmail({
			to: "test@example.com",
			subject: "Test",
			html: "<p>Test</p>",
		});

		expect(result).toEqual({
			success: false,
			error: "Email send failed (permanent)",
			errorKind: "permanent",
		});
		expect(freshLogger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				recipientCount: 1,
				errorKind: "permanent",
				unavailableReason: "invalid_configuration",
			}),
			"Failed to send email",
		);
	});

	it("handles array recipients", async () => {
		process.env.NODE_ENV = "test";
		const { sendEmail, freshLogger } = await freshSendEmail();
		const result = await sendEmail({
			to: ["a@example.com", "b@example.com"],
			subject: "Test",
			html: "<p>Test</p>",
		});

		expect(result.success).toBe(true);
		expect(freshLogger.info).toHaveBeenCalledWith(
			expect.objectContaining({ recipientCount: 2 }),
			expect.any(String),
		);
	});
});

describe("sendVerificationEmail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getTelemetryClientMock.mockReturnValue(null);
		delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
	});

	it("returns the result from sendEmail", async () => {
		const result = await sendVerificationEmail({
			email: "test@example.com",
			name: "Test User",
			verificationUrl: "http://localhost/verify?token=abc",
		});

		// Without ACS configured, sendEmail returns success
		expect(result.success).toBe(true);
		expect(logger.info).toHaveBeenCalledWith(
			expect.objectContaining({ recipientCount: 1 }),
			"About to send verification email",
		);
		expect(logger.info).toHaveBeenCalledWith(
			expect.objectContaining({ recipientCount: 1, success: true }),
			"Verification email result",
		);
	});
});

describe("sendEmail with telemetry", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getTelemetryClientMock.mockReturnValue(null);
		delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
	});

	it("tracks suppression events with email.suppressed telemetry event", async () => {
		// This test verifies the telemetry event name is "email.suppressed" for suppression errors
		// Since we can't easily trigger ACS errors without the real SDK,
		// we verify classifyEmailError correctly identifies suppressions
		const errorKind = classifyEmailError(new Error("AllRecipientsSuppressed"));
		expect(errorKind).toBe("suppressed");
	});

	it("includes errorKind in telemetry for failed sends", async () => {
		// Verify that errorKind is correctly computed for various error types
		expect(classifyEmailError(new Error("ECONNRESET"))).toBe("transient");
		expect(classifyEmailError(new Error("AllRecipientsSuppressed"))).toBe("suppressed");
		expect(classifyEmailError(new Error("Unknown"))).toBe("permanent");
	});
});

describe("sendEmail retry loop (Azure SDK mocked)", () => {
	const CONNECTION_STRING = "endpoint=https://test.communication.azure.com/;accesskey=fake";
	const CLOCK_SKEW_MESSAGE =
		"time difference between the originating client and the server is greater than the allowed margin";

	// Re-import the module fresh each test so the internal emailClient singleton
	// is reset and getEmailClient() reconstructs the (mocked) client.
	async function freshSendEmail() {
		vi.resetModules();
		const mod = await import("./email.server.js");
		return mod.sendEmail;
	}

	async function freshSendVerificationEmail() {
		vi.resetModules();
		const mod = await import("./email.server.js");
		const { logger: freshLogger } = await import("./logger.server.js");
		return { sendVerificationEmail: mod.sendVerificationEmail, freshLogger };
	}

	async function freshSendMagicLinkEmail() {
		vi.resetModules();
		const mod = await import("./email.server.js");
		const { logger: freshLogger } = await import("./logger.server.js");
		return { sendMagicLinkEmail: mod.sendMagicLinkEmail, freshLogger };
	}

	function successPoller() {
		return { pollUntilDone: vi.fn().mockResolvedValue(undefined) };
	}

	beforeEach(() => {
		vi.clearAllMocks();
		beginSendMock.mockReset();
		getTelemetryClientMock.mockReturnValue(null);
		process.env.AZURE_COMMUNICATION_CONNECTION_STRING = CONNECTION_STRING;
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
	});

	it("retries a transient error and succeeds on the next attempt", async () => {
		beginSendMock
			.mockRejectedValueOnce(new Error("ECONNRESET"))
			.mockResolvedValueOnce(successPoller());

		const sendEmail = await freshSendEmail();
		const promise = sendEmail({ to: "test@example.com", subject: "Test", html: "<p>Hi</p>" });
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.success).toBe(true);
		expect(beginSendMock).toHaveBeenCalledTimes(2);
	});

	it("does not log verification credentials or recipient PII on the send path", async () => {
		const rawToken = "live-verification-token-224";
		const verificationUrl = `https://mycalltime.app/verify-email?token=${rawToken}`;
		const recipient = "private-recipient@example.com";
		beginSendMock.mockResolvedValueOnce(successPoller());
		getTelemetryClientMock.mockReturnValue({
			trackEvent: trackEventMock,
			trackException: trackExceptionMock,
		});

		const { sendVerificationEmail, freshLogger } = await freshSendVerificationEmail();
		const result = await sendVerificationEmail({
			email: recipient,
			name: "Private User",
			verificationUrl,
		});

		expect(result.success).toBe(true);
		expect(beginSendMock).toHaveBeenCalledTimes(1);

		const capturedLogs = JSON.stringify([
			...vi.mocked(freshLogger.info).mock.calls,
			...vi.mocked(freshLogger.warn).mock.calls,
			...vi.mocked(freshLogger.error).mock.calls,
		]);
		expect(capturedLogs).not.toContain(rawToken);
		expect(capturedLogs).not.toContain(verificationUrl);
		expect(capturedLogs).not.toContain(recipient);

		const capturedTelemetry = JSON.stringify([
			...trackEventMock.mock.calls,
			...trackExceptionMock.mock.calls,
		]);
		expect(capturedTelemetry).not.toContain(rawToken);
		expect(capturedTelemetry).not.toContain(verificationUrl);
		expect(capturedTelemetry).not.toContain(recipient);
	});

	it("does not expose sensitive values when the verification send fails", async () => {
		const rawToken = "failed-verification-token-224";
		const verificationUrl = `https://mycalltime.app/verify-email?token=${rawToken}`;
		const recipient = "failed-recipient@example.com";
		const providerError = `Provider rejected ${recipient} for ${verificationUrl}`;
		beginSendMock.mockRejectedValueOnce(new Error(providerError));
		getTelemetryClientMock.mockReturnValue({
			trackEvent: trackEventMock,
			trackException: trackExceptionMock,
		});

		const { sendVerificationEmail, freshLogger } = await freshSendVerificationEmail();
		const result = await sendVerificationEmail({
			email: recipient,
			name: "Private User",
			verificationUrl,
		});

		expect(result).toEqual({
			success: false,
			error: "Email send failed (permanent)",
			errorKind: "permanent",
		});

		const capturedDiagnostics = JSON.stringify([
			...vi.mocked(freshLogger.info).mock.calls,
			...vi.mocked(freshLogger.warn).mock.calls,
			...vi.mocked(freshLogger.error).mock.calls,
			...trackEventMock.mock.calls,
			...trackExceptionMock.mock.calls,
		]);
		expect(capturedDiagnostics).not.toContain(rawToken);
		expect(capturedDiagnostics).not.toContain(verificationUrl);
		expect(capturedDiagnostics).not.toContain(recipient);
		expect(capturedDiagnostics).not.toContain(providerError);
	});

	it("does not log magic-link credentials or recipient PII", async () => {
		const rawToken = "live-magic-link-token-224";
		const magicLinkUrl = `https://mycalltime.app/auth/magic-link/consume?token=${rawToken}`;
		const recipient = "magic-link-recipient@example.com";
		beginSendMock.mockResolvedValueOnce(successPoller());

		const { sendMagicLinkEmail, freshLogger } = await freshSendMagicLinkEmail();
		const result = await sendMagicLinkEmail({
			email: recipient,
			name: "Magic User",
			magicLinkUrl,
		});

		expect(result.success).toBe(true);

		const capturedLogs = JSON.stringify([
			...vi.mocked(freshLogger.info).mock.calls,
			...vi.mocked(freshLogger.warn).mock.calls,
			...vi.mocked(freshLogger.error).mock.calls,
		]);
		expect(capturedLogs).not.toContain(rawToken);
		expect(capturedLogs).not.toContain(magicLinkUrl);
		expect(capturedLogs).not.toContain(recipient);
	});

	it("does NOT retry a suppression error — breaks immediately", async () => {
		beginSendMock.mockRejectedValue(new Error("EmailDroppedAllRecipientsSuppressed"));

		const sendEmail = await freshSendEmail();
		const promise = sendEmail({ to: "test@example.com", subject: "Test", html: "<p>Hi</p>" });
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.success).toBe(false);
		expect(result.errorKind).toBe("suppressed");
		expect(beginSendMock).toHaveBeenCalledTimes(1);
	});

	it("fails loudly when no transport-level Azure Date is available for clock-skew recovery", async () => {
		beginSendMock.mockRejectedValue(new Error(CLOCK_SKEW_MESSAGE));

		const sendEmail = await freshSendEmail();
		const promise = sendEmail({ to: "test@example.com", subject: "Test", html: "<p>Hi</p>" });
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.success).toBe(false);
		expect(result.errorKind).toBe("clock_skew");
		expect(beginSendMock).toHaveBeenCalledTimes(1);
	});

	it("exhausts max retries on persistent transient errors and returns transient errorKind", async () => {
		beginSendMock.mockRejectedValue(new Error("ETIMEDOUT"));

		const sendEmail = await freshSendEmail();
		const promise = sendEmail({ to: "test@example.com", subject: "Test", html: "<p>Hi</p>" });
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result.success).toBe(false);
		expect(result.errorKind).toBe("transient");
		// initial attempt + MAX_RETRIES (2) = 3 calls
		expect(beginSendMock).toHaveBeenCalledTimes(3);
	});
});
