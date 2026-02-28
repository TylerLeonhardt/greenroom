import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock session to control userId
vi.mock("~/services/session.server", () => ({
	getUserId: vi.fn(),
	getSession: vi.fn(),
	sessionStorage: { commitSession: vi.fn() },
}));

// Mock DB — control query results
const mockLimit = vi.fn();
const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock("../../src/db/index.js", () => ({
	db: {
		select: (...args: unknown[]) => mockSelect(...args),
	},
}));

import { getUserId } from "~/services/session.server";
import { requireUser } from "./auth.server";

// Helper to make a verified user DB record
function makeUserRecord(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "user-1",
		email: "test@example.com",
		name: "Test",
		passwordHash: "$2a$12$hash",
		profileImage: null,
		googleId: null,
		emailVerified: true,
		emailVerificationToken: null,
		emailVerificationExpiry: null,
		timezone: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

// The AuthUser shape returned by requireUser
function expectedAuthUser(record: ReturnType<typeof makeUserRecord>) {
	return {
		id: record.id,
		email: record.email,
		name: record.name,
		profileImage: record.profileImage,
		timezone: record.timezone,
	};
}

describe("requireUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function setupDbResponses(...results: unknown[][]) {
		// Each call to db.select()...from()...where()...limit() returns the next result
		for (let i = 0; i < results.length; i++) {
			const limitFn = vi.fn().mockResolvedValue(results[i]);
			const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
			const fromFn = vi.fn().mockReturnValue({ where: whereFn });
			if (i === 0) {
				mockSelect.mockReturnValueOnce({ from: fromFn });
			} else {
				mockSelect.mockReturnValueOnce({ from: fromFn });
			}
		}
	}

	it("redirects to /login when no userId in session", async () => {
		(getUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		try {
			await requireUser(new Request("http://localhost/dashboard"));
			expect.fail("Should have thrown a redirect");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(302);
			expect((response as Response).headers.get("Location")).toBe("/login");
		}
	});

	it("redirects to /login when user not found in DB", async () => {
		(getUserId as ReturnType<typeof vi.fn>).mockResolvedValue("nonexistent-id");
		setupDbResponses([]); // getUserById returns no results

		try {
			await requireUser(new Request("http://localhost/dashboard"));
			expect.fail("Should have thrown a redirect");
		} catch (response) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(302);
			expect((response as Response).headers.get("Location")).toBe("/login");
		}
	});

	it("returns user when session is valid (no email verification check)", async () => {
		const record = makeUserRecord({ emailVerified: true });
		(getUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
		setupDbResponses([record]);

		const result = await requireUser(new Request("http://localhost/dashboard"));
		expect(result).toEqual(expectedAuthUser(record));
	});

	it("returns user on any path when session is valid", async () => {
		const record = makeUserRecord({ emailVerified: true });
		(getUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-1");
		setupDbResponses([record]);

		const result = await requireUser(new Request("http://localhost/groups/some-id/events"));
		expect(result).toEqual(expectedAuthUser(record));
	});

	it("returns verified Google OAuth user", async () => {
		const record = makeUserRecord({
			id: "user-2",
			email: "google@example.com",
			name: "Google User",
			profileImage: "https://example.com/photo.jpg",
			googleId: "google-123",
			emailVerified: true,
			timezone: "America/Los_Angeles",
		});
		(getUserId as ReturnType<typeof vi.fn>).mockResolvedValue("user-2");
		setupDbResponses([record]);

		const result = await requireUser(new Request("http://localhost/groups/some-id/events"));
		expect(result).toEqual(expectedAuthUser(record));
	});
});
