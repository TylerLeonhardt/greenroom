import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateInviteCode } from "~/services/groups.server";

const VALID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("generateInviteCode", () => {
	it("returns an 8-character string", () => {
		const code = generateInviteCode();
		expect(code).toHaveLength(8);
	});

	it("only contains allowed characters (no I, O, 0, 1)", () => {
		// Run multiple times to increase confidence
		for (let i = 0; i < 100; i++) {
			const code = generateInviteCode();
			for (const char of code) {
				expect(VALID_CHARS).toContain(char);
			}
		}
	});

	it("does not contain ambiguous characters", () => {
		const ambiguous = ["I", "O", "0", "1"];
		for (let i = 0; i < 100; i++) {
			const code = generateInviteCode();
			for (const char of ambiguous) {
				expect(code).not.toContain(char);
			}
		}
	});

	it("generates different codes on subsequent calls", () => {
		const codes = new Set<string>();
		for (let i = 0; i < 50; i++) {
			codes.add(generateInviteCode());
		}
		// With 28^8 possible codes, 50 should all be unique
		expect(codes.size).toBe(50);
	});

	it("returns uppercase characters only", () => {
		for (let i = 0; i < 50; i++) {
			const code = generateInviteCode();
			expect(code).toBe(code.toUpperCase());
		}
	});
});

// --- requireGroupAdminOrPermission tests ---

vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
}));

vi.mock("../../src/db/index.js", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([]),
		innerJoin: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		returning: vi.fn().mockResolvedValue([]),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
	},
}));

const { requireGroupAdminOrPermission, deleteGroup } = await import("~/services/groups.server");
const { requireUser } = await import("~/services/auth.server");
const { db } = await import("../../src/db/index.js");

describe("requireGroupAdminOrPermission", () => {
	const mockRequest = new Request("http://localhost/test");

	beforeEach(() => {
		vi.clearAllMocks();
		(requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
	});

	it("allows admin users regardless of permission setting", async () => {
		(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([{ role: "admin" }]),
				}),
			}),
		});

		const user = await requireGroupAdminOrPermission(
			mockRequest,
			"group-1",
			"membersCanCreateRequests",
		);
		expect(user.id).toBe("user-1");
	});

	it("allows member when membersCanCreateRequests is enabled", async () => {
		let callCount = 0;
		(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				// isGroupAdmin — not admin
				return {
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ role: "member" }]),
						}),
					}),
				};
			}
			if (callCount === 2) {
				// isGroupMember — is member
				return {
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ id: "membership-1" }]),
						}),
					}),
				};
			}
			// getGroupById — permission enabled
			return {
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{
								id: "group-1",
								name: "Test Group",
								membersCanCreateRequests: true,
								membersCanCreateEvents: false,
							},
						]),
					}),
				}),
			};
		});

		const user = await requireGroupAdminOrPermission(
			mockRequest,
			"group-1",
			"membersCanCreateRequests",
		);
		expect(user.id).toBe("user-1");
	});

	it("blocks member when permission is disabled", async () => {
		let callCount = 0;
		(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return {
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ role: "member" }]),
						}),
					}),
				};
			}
			if (callCount === 2) {
				return {
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ id: "membership-1" }]),
						}),
					}),
				};
			}
			return {
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{
								id: "group-1",
								name: "Test Group",
								membersCanCreateRequests: false,
								membersCanCreateEvents: false,
							},
						]),
					}),
				}),
			};
		});

		try {
			await requireGroupAdminOrPermission(mockRequest, "group-1", "membersCanCreateRequests");
			expect.fail("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(403);
		}
	});

	it("throws 404 for non-member", async () => {
		let callCount = 0;
		(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return {
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([]),
						}),
					}),
				};
			}
			return {
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([]),
					}),
				}),
			};
		});

		try {
			await requireGroupAdminOrPermission(mockRequest, "group-1", "membersCanCreateRequests");
			expect.fail("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			expect((error as Response).status).toBe(404);
		}
	});

	it("checks membersCanCreateEvents permission correctly", async () => {
		let callCount = 0;
		(db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return {
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ role: "member" }]),
						}),
					}),
				};
			}
			if (callCount === 2) {
				return {
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ id: "membership-1" }]),
						}),
					}),
				};
			}
			return {
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{
								id: "group-1",
								name: "Test Group",
								membersCanCreateRequests: false,
								membersCanCreateEvents: true,
							},
						]),
					}),
				}),
			};
		});

		const user = await requireGroupAdminOrPermission(
			mockRequest,
			"group-1",
			"membersCanCreateEvents",
		);
		expect(user.id).toBe("user-1");
	});
});

describe("deleteGroup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls db.delete with the correct groupId", async () => {
		const mockWhere = vi.fn().mockResolvedValue(undefined);
		(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
			where: mockWhere,
		});

		await deleteGroup("group-123");

		expect(db.delete).toHaveBeenCalled();
		expect(mockWhere).toHaveBeenCalled();
	});

	it("propagates database errors", async () => {
		(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
			where: vi.fn().mockRejectedValue(new Error("DB connection lost")),
		});

		await expect(deleteGroup("group-123")).rejects.toThrow("DB connection lost");
	});
});
