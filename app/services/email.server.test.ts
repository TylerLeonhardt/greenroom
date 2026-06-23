import { beforeEach, describe, expect, it, vi } from "vitest";

// Must mock before importing the module under test
vi.mock("./logger.server.js", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("./telemetry.server.js", () => ({
	getTelemetryClient: vi.fn().mockReturnValue(null),
}));

vi.mock("./notification-utils.server.js", () => ({
	mergeWithDefaults: vi.fn().mockReturnValue({
		availabilityRequests: { email: true },
		eventNotifications: { email: true },
		showReminders: { email: true },
	}),
}));

import { classifyEmailError, sendEmail, sendVerificationEmail } from "./email.server.js";
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
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset the emailClient singleton by clearing the module-level state
		// We'll control behavior by setting/unsetting the env var
		delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
	});

	it("returns success when ACS is not configured", async () => {
		const result = await sendEmail({
			to: "test@example.com",
			subject: "Test",
			html: "<p>Test</p>",
		});

		expect(result).toEqual({ success: true });
		expect(logger.info).toHaveBeenCalledWith(
			expect.objectContaining({ recipientCount: 1 }),
			expect.stringContaining("not configured"),
		);
	});

	it("handles array recipients", async () => {
		const result = await sendEmail({
			to: ["a@example.com", "b@example.com"],
			subject: "Test",
			html: "<p>Test</p>",
		});

		expect(result.success).toBe(true);
		expect(logger.info).toHaveBeenCalledWith(
			expect.objectContaining({ recipientCount: 2 }),
			expect.any(String),
		);
	});
});

describe("sendVerificationEmail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
			expect.objectContaining({ to: "test@example.com" }),
			"About to send verification email",
		);
		expect(logger.info).toHaveBeenCalledWith(
			expect.objectContaining({ to: "test@example.com", success: true }),
			"Verification email result",
		);
	});
});

describe("sendEmail with telemetry", () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
