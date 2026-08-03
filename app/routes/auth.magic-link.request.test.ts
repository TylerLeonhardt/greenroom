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
	logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("~/services/magic-link.server", () => ({
	cleanupExpiredMagicLinks: vi.fn().mockResolvedValue(0),
	issueLoginMagicLink: vi.fn().mockResolvedValue({
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

import { action, MAGIC_LINK_GENERIC_RESPONSE } from "~/routes/auth.magic-link.request";
import { getUserByEmail } from "~/services/auth.server";
import { performDummyHashComparison } from "~/services/auth-timing.server";
import { validateCsrfToken } from "~/services/csrf.server";
import { sendMagicLinkEmail } from "~/services/email.server";
import { cleanupExpiredMagicLinks, issueLoginMagicLink } from "~/services/magic-link.server";
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
		(issueLoginMagicLink as ReturnType<typeof vi.fn>).mockResolvedValue({
			rawToken: "a".repeat(43),
			expiresAt: new Date(),
		});
		(sendMagicLinkEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
		(cleanupExpiredMagicLinks as ReturnType<typeof vi.fn>).mockResolvedValue(0);
	});

	it("returns the same response without awaiting email delivery for known and unknown emails", async () => {
		let resolveEmail: ((value: { success: true }) => void) | undefined;
		const pendingEmail = new Promise<{ success: true }>((resolve) => {
			resolveEmail = resolve;
		});
		(sendMagicLinkEmail as ReturnType<typeof vi.fn>).mockReturnValue(pendingEmail);
		(getUserByEmail as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({
				id: "user-1",
				email: "user@example.com",
				name: "User",
				emailVerified: true,
				deletedAt: null,
			})
			.mockResolvedValueOnce(undefined);

		const known = await action({ request: makeRequest(), params: {}, context: {} });
		const unknown = await action({
			request: makeRequest("unknown@example.com"),
			params: {},
			context: {},
		});

		expect(known).toEqual({ success: true, message: MAGIC_LINK_GENERIC_RESPONSE });
		expect(unknown).toEqual({ success: true, message: MAGIC_LINK_GENERIC_RESPONSE });
		expect(performDummyHashComparison).toHaveBeenCalledTimes(2);
		expect(issueLoginMagicLink).toHaveBeenCalledTimes(1);
		expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
		expect(cleanupExpiredMagicLinks).toHaveBeenCalledTimes(1);

		resolveEmail?.({ success: true });
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

	it("returns without awaiting token persistence", async () => {
		let resolveIssue: ((value: { rawToken: string; expiresAt: Date }) => void) | undefined;
		const pendingIssue = new Promise<{ rawToken: string; expiresAt: Date }>((resolve) => {
			resolveIssue = resolve;
		});
		(issueLoginMagicLink as ReturnType<typeof vi.fn>).mockReturnValue(pendingIssue);
		(getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			name: "User",
			emailVerified: true,
			deletedAt: null,
		});

		const response = await action({ request: makeRequest(), params: {}, context: {} });

		expect(response).toEqual({ success: true, message: MAGIC_LINK_GENERIC_RESPONSE });
		expect(sendMagicLinkEmail).not.toHaveBeenCalled();
		resolveIssue?.({ rawToken: "a".repeat(43), expiresAt: new Date() });
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
