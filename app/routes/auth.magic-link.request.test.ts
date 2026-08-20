import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth-timing.server", () => ({
	performDummyHashComparison: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("~/services/auth.server", () => ({
	getUserByEmail: vi.fn(),
}));
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("~/services/email.server", () => ({
	sendMagicLinkEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("~/services/logger.server", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("~/services/magic-link.server", () => ({
	activateLoginMagicLink: vi.fn().mockResolvedValue(undefined),
	cleanupExpiredMagicLinks: vi.fn().mockResolvedValue(0),
	invalidateLoginMagicLink: vi.fn().mockResolvedValue(undefined),
	issuePendingLoginMagicLink: vi.fn().mockResolvedValue({
		rawToken: "a".repeat(43),
		expiresAt: new Date(),
	}),
	validateMagicLinkRedirectPath: vi.fn((value: string | null) => value ?? "/dashboard"),
}));
vi.mock("~/services/rate-limit.server", () => ({
	checkLoginRateLimit: vi.fn().mockReturnValue({ limited: false }),
	checkRateLimit: vi.fn().mockReturnValue({ limited: false }),
	getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import {
	action,
	MAGIC_LINK_DELIVERY_ERROR,
	MAGIC_LINK_GENERIC_RESPONSE,
} from "~/routes/auth.magic-link.request";
import { getUserByEmail } from "~/services/auth.server";
import { performDummyHashComparison } from "~/services/auth-timing.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { sendMagicLinkEmail } from "~/services/email.server";
import { logger } from "~/services/logger.server";
import {
	activateLoginMagicLink,
	cleanupExpiredMagicLinks,
	invalidateLoginMagicLink,
	issuePendingLoginMagicLink,
} from "~/services/magic-link.server";
import { checkLoginRateLimit, checkRateLimit } from "~/services/rate-limit.server";

function makeRequest(email = "user@example.com") {
	return new Request("http://localhost/auth/magic-link/request", {
		method: "POST",
		body: new URLSearchParams({ email }),
		headers: { "x-forwarded-for": "127.0.0.1" },
	});
}

describe("magic-link request route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(checkLoginRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
		(checkRateLimit as ReturnType<typeof vi.fn>).mockReturnValue({ limited: false });
		(validateCsrfToken as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(issuePendingLoginMagicLink as ReturnType<typeof vi.fn>).mockResolvedValue({
			rawToken: "a".repeat(43),
			expiresAt: new Date(),
		});
		(activateLoginMagicLink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(sendMagicLinkEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
		(cleanupExpiredMagicLinks as ReturnType<typeof vi.fn>).mockResolvedValue(0);
		(invalidateLoginMagicLink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
	});

	it("awaits issuance and real delivery before reporting success", async () => {
		let resolveIssue: ((value: { rawToken: string; expiresAt: Date }) => void) | undefined;
		const pendingIssue = new Promise<{ rawToken: string; expiresAt: Date }>((resolve) => {
			resolveIssue = resolve;
		});
		let resolveEmail: ((value: { success: true }) => void) | undefined;
		const pendingEmail = new Promise<{ success: true }>((resolve) => {
			resolveEmail = resolve;
		});
		(issuePendingLoginMagicLink as ReturnType<typeof vi.fn>).mockReturnValue(pendingIssue);
		(sendMagicLinkEmail as ReturnType<typeof vi.fn>).mockReturnValue(pendingEmail);
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "User",
			emailVerified: true,
			deletedAt: null,
		});

		let settled = false;
		const responsePromise = action({ request: makeRequest(), params: {}, context: {} }).then(
			(response) => {
				settled = true;
				return response;
			},
		);
		await vi.waitFor(() => {
			expect(issuePendingLoginMagicLink).toHaveBeenCalledTimes(1);
		});
		expect(issuePendingLoginMagicLink).toHaveBeenCalledWith({
			userId: "user-1",
			redirectPath: "/dashboard",
			expiryMinutes: 15,
		});

		expect(settled).toBe(false);
		expect(sendMagicLinkEmail).not.toHaveBeenCalled();

		resolveIssue?.({ rawToken: "a".repeat(43), expiresAt: new Date() });
		await vi.waitFor(() => {
			expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
		});

		expect(settled).toBe(false);

		resolveEmail?.({ success: true });
		await expect(responsePromise).resolves.toEqual({
			success: true,
			message: MAGIC_LINK_GENERIC_RESPONSE,
		});
		expect(cleanupExpiredMagicLinks).toHaveBeenCalledTimes(1);
		expect(activateLoginMagicLink).toHaveBeenCalledWith("a".repeat(43));
		expect(invalidateLoginMagicLink).not.toHaveBeenCalled();
	});

	it("preserves the generic anti-enumeration response for unknown accounts", async () => {
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

		const response = await action({
			request: makeRequest("unknown@example.com"),
			params: {},
			context: {},
		});

		expect(response).toEqual({ success: true, message: MAGIC_LINK_GENERIC_RESPONSE });
		expect(performDummyHashComparison).toHaveBeenCalledTimes(1);
		expect(issuePendingLoginMagicLink).not.toHaveBeenCalled();
		expect(sendMagicLinkEmail).not.toHaveBeenCalled();
	});

	it("reports and logs failed delivery without exposing credentials or PII", async () => {
		const rawToken = "sensitive-magic-link-token";
		const recipient = "private@example.com";
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: recipient,
			name: "User",
			emailVerified: true,
			deletedAt: null,
		});
		(issuePendingLoginMagicLink as ReturnType<typeof vi.fn>).mockResolvedValue({
			rawToken,
			expiresAt: new Date(),
		});
		(sendMagicLinkEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			success: false,
			error: "Email send failed (transient)",
			errorKind: "transient",
		});

		const response = await action({ request: makeRequest(recipient), params: {}, context: {} });

		expect(response).toEqual({ success: false, error: MAGIC_LINK_DELIVERY_ERROR });
		expect(invalidateLoginMagicLink).toHaveBeenCalledWith(rawToken);
		expect(activateLoginMagicLink).not.toHaveBeenCalled();
		expect(cleanupExpiredMagicLinks).not.toHaveBeenCalled();
		const capturedOutput = JSON.stringify([
			...vi.mocked(logger.info).mock.calls,
			...vi.mocked(logger.warn).mock.calls,
			...vi.mocked(logger.error).mock.calls,
		]);
		expect(capturedOutput).toContain("Magic-link email delivery failed");
		expect(capturedOutput).toContain('"errorKind":"transient"');
		expect(capturedOutput).toContain('"userId":"user-1"');
		expect(capturedOutput).toContain('"timingMs":');
		expect(capturedOutput).not.toContain(rawToken);
		expect(capturedOutput).not.toContain(recipient);
	});

	it("invalidates an issued token when email delivery rejects", async () => {
		const rawToken = "rejected-magic-link-token";
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "User",
			emailVerified: true,
			deletedAt: null,
		});
		(issuePendingLoginMagicLink as ReturnType<typeof vi.fn>).mockResolvedValue({
			rawToken,
			expiresAt: new Date(),
		});
		(sendMagicLinkEmail as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("provider rejected"),
		);

		const response = await action({ request: makeRequest(), params: {}, context: {} });

		expect(response).toEqual({ success: false, error: MAGIC_LINK_DELIVERY_ERROR });
		expect(invalidateLoginMagicLink).toHaveBeenCalledWith(rawToken);
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				errorKind: "delivery_rejected",
				timingMs: expect.any(Number),
			}),
			"Magic-link request failed",
		);
	});

	it("does not report success when delivered-token activation fails", async () => {
		const rawToken = "activation-failure-token";
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "User",
			emailVerified: true,
			deletedAt: null,
		});
		(issuePendingLoginMagicLink as ReturnType<typeof vi.fn>).mockResolvedValue({
			rawToken,
			expiresAt: new Date(),
		});
		(activateLoginMagicLink as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("activation failed"),
		);

		const response = await action({ request: makeRequest(), params: {}, context: {} });

		expect(response).toEqual({ success: false, error: MAGIC_LINK_DELIVERY_ERROR });
		expect(invalidateLoginMagicLink).toHaveBeenCalledWith(rawToken);
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				errorKind: "activation",
				timingMs: expect.any(Number),
			}),
			"Magic-link request failed",
		);
	});

	it("reports an issuance failure without attempting delivery", async () => {
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "User",
			emailVerified: true,
			deletedAt: null,
		});
		(issuePendingLoginMagicLink as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("database unavailable"),
		);

		const response = await action({ request: makeRequest(), params: {}, context: {} });

		expect(response).toEqual({ success: false, error: MAGIC_LINK_DELIVERY_ERROR });
		expect(sendMagicLinkEmail).not.toHaveBeenCalled();
		expect(activateLoginMagicLink).not.toHaveBeenCalled();
		expect(invalidateLoginMagicLink).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				errorKind: "issuance",
				timingMs: expect.any(Number),
			}),
			"Magic-link request failed",
		);
	});

	it("does not fail the request when expired-token cleanup fails", async () => {
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "User",
			emailVerified: true,
			deletedAt: null,
		});
		(cleanupExpiredMagicLinks as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("cleanup failed"),
		);

		const response = await action({ request: makeRequest(), params: {}, context: {} });

		expect(response).toEqual({ success: true, message: MAGIC_LINK_GENERIC_RESPONSE });
		await vi.waitFor(() => {
			expect(cleanupExpiredMagicLinks).toHaveBeenCalledTimes(1);
		});
	});

	it("requires CSRF validation", async () => {
		const csrfError = new Response("Invalid CSRF token", { status: 403 });
		(validateCsrfToken as ReturnType<typeof vi.fn>).mockRejectedValue(csrfError);

		await expect(action({ request: makeRequest(), params: {}, context: {} })).rejects.toBe(
			csrfError,
		);
		expect(getUserByEmail).not.toHaveBeenCalled();
	});

	it("enforces the email-digest rate limit", async () => {
		(checkRateLimit as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce({ limited: false })
			.mockReturnValueOnce({ limited: true, retryAfter: 60 });

		const response = await action({ request: makeRequest(), params: {}, context: {} });

		expect(response).toBeInstanceOf(Response);
		expect((response as Response).status).toBe(429);
		expect((response as Response).headers.get("Retry-After")).toBe("60");
		expect(performDummyHashComparison).not.toHaveBeenCalled();
		expect(getUserByEmail).not.toHaveBeenCalled();
	});
});
