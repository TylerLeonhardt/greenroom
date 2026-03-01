import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock the DB layer ---

const mockSelect = vi.fn();
const mockTransaction = vi.fn().mockImplementation(async (cb) => {
	return cb({
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	});
});

vi.mock("../../src/db/index.js", () => ({
	db: {
		select: (...args: unknown[]) => mockSelect(...args),
		transaction: (...args: unknown[]) => mockTransaction(...args),
	},
}));

vi.mock("./logger.server.js", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

const { getAccountDeletionPreview, executeAccountDeletion } = await import(
	"~/services/account.server"
);

describe("getAccountDeletionPreview", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns empty preview when user has no groups", async () => {
		// Mock memberships query
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			}),
		});

		// Mock request count
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 0 }]),
			}),
		});

		// Mock event count
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 0 }]),
			}),
		});

		const preview = await getAccountDeletionPreview("user-1");

		expect(preview.soleAdminGroups).toHaveLength(0);
		expect(preview.sharedAdminGroups).toHaveLength(0);
		expect(preview.memberOnlyGroups).toHaveLength(0);
		expect(preview.createdRequestCount).toBe(0);
		expect(preview.createdEventCount).toBe(0);
	});

	it("correctly categorizes sole-admin groups", async () => {
		// Mock memberships query — user is admin of one group
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi
						.fn()
						.mockResolvedValue([{ groupId: "g1", role: "admin", groupName: "My Group" }]),
				}),
			}),
		});

		// Mock all members of group g1 (just the user — sole admin)
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{ userId: "user-1", role: "admin", name: "Test User" },
						{ userId: "user-2", role: "member", name: "Other User" },
					]),
				}),
			}),
		});

		// Mock request count
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 3 }]),
			}),
		});

		// Mock event count
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 1 }]),
			}),
		});

		const preview = await getAccountDeletionPreview("user-1");

		expect(preview.soleAdminGroups).toHaveLength(1);
		expect(preview.soleAdminGroups[0].groupId).toBe("g1");
		expect(preview.soleAdminGroups[0].isSoleAdmin).toBe(true);
		expect(preview.soleAdminGroups[0].otherMembers).toHaveLength(1);
		expect(preview.soleAdminGroups[0].otherMembers[0].id).toBe("user-2");
		expect(preview.sharedAdminGroups).toHaveLength(0);
		expect(preview.memberOnlyGroups).toHaveLength(0);
		expect(preview.createdRequestCount).toBe(3);
		expect(preview.createdEventCount).toBe(1);
	});

	it("correctly categorizes shared-admin groups", async () => {
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi
						.fn()
						.mockResolvedValue([{ groupId: "g1", role: "admin", groupName: "Shared Group" }]),
				}),
			}),
		});

		// Group has two admins
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{ userId: "user-1", role: "admin", name: "Test User" },
						{ userId: "user-2", role: "admin", name: "Other Admin" },
					]),
				}),
			}),
		});

		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 0 }]),
			}),
		});

		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 0 }]),
			}),
		});

		const preview = await getAccountDeletionPreview("user-1");

		expect(preview.soleAdminGroups).toHaveLength(0);
		expect(preview.sharedAdminGroups).toHaveLength(1);
		expect(preview.sharedAdminGroups[0].groupId).toBe("g1");
		expect(preview.sharedAdminGroups[0].isSoleAdmin).toBe(false);
		expect(preview.sharedAdminGroups[0].otherAdmins).toHaveLength(1);
	});

	it("correctly categorizes member-only groups", async () => {
		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi
						.fn()
						.mockResolvedValue([{ groupId: "g1", role: "member", groupName: "Member Group" }]),
				}),
			}),
		});

		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{ userId: "user-1", role: "member", name: "Test User" },
						{ userId: "admin-1", role: "admin", name: "Admin" },
					]),
				}),
			}),
		});

		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 0 }]),
			}),
		});

		mockSelect.mockReturnValueOnce({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 0 }]),
			}),
		});

		const preview = await getAccountDeletionPreview("user-1");

		expect(preview.soleAdminGroups).toHaveLength(0);
		expect(preview.sharedAdminGroups).toHaveLength(0);
		expect(preview.memberOnlyGroups).toHaveLength(1);
		expect(preview.memberOnlyGroups[0].groupId).toBe("g1");
	});
});

describe("executeAccountDeletion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls transaction for deletion", async () => {
		// Set up the tx mock to handle the full flow
		const mockTxUpdate = vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		});
		const mockTxDelete = vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		});
		const mockTxSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		mockTransaction.mockImplementationOnce(async (cb) => {
			await cb({
				update: mockTxUpdate,
				delete: mockTxDelete,
				select: mockTxSelect,
			});
		});

		await executeAccountDeletion("user-1", []);

		expect(mockTransaction).toHaveBeenCalledTimes(1);
		// Should have updated the user with deletedAt
		expect(mockTxUpdate).toHaveBeenCalled();
		// Should have deleted memberships, responses, assignments
		expect(mockTxDelete).toHaveBeenCalled();
	});

	it("handles transfer decision correctly", async () => {
		const mockTxUpdate = vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		});
		const mockTxDelete = vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		});
		const mockTxSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		mockTransaction.mockImplementationOnce(async (cb) => {
			await cb({
				update: mockTxUpdate,
				delete: mockTxDelete,
				select: mockTxSelect,
			});
		});

		await executeAccountDeletion("user-1", [
			{ action: "transfer", groupId: "g1", newAdminId: "user-2" },
		]);

		expect(mockTransaction).toHaveBeenCalledTimes(1);
		// update should be called for: promote new admin, reassign group createdById,
		// reassign requests, reassign events, and final soft-delete
		expect(mockTxUpdate).toHaveBeenCalled();
	});

	it("handles delete decision correctly", async () => {
		const mockTxUpdate = vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		});
		const mockTxDelete = vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		});
		const mockTxSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		mockTransaction.mockImplementationOnce(async (cb) => {
			await cb({
				update: mockTxUpdate,
				delete: mockTxDelete,
				select: mockTxSelect,
			});
		});

		await executeAccountDeletion("user-1", [{ action: "delete", groupId: "g1" }]);

		expect(mockTransaction).toHaveBeenCalledTimes(1);
		// Should delete the group directly within the transaction
		expect(mockTxDelete).toHaveBeenCalled();
	});

	it("handles mixed decisions (transfer and delete)", async () => {
		const mockTxUpdate = vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		});
		const mockTxDelete = vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		});
		const mockTxSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		mockTransaction.mockImplementationOnce(async (cb) => {
			await cb({
				update: mockTxUpdate,
				delete: mockTxDelete,
				select: mockTxSelect,
			});
		});

		await executeAccountDeletion("user-1", [
			{ action: "transfer", groupId: "g1", newAdminId: "user-2" },
			{ action: "delete", groupId: "g2" },
		]);

		expect(mockTransaction).toHaveBeenCalledTimes(1);
	});

	it("handles empty decisions (no sole-admin groups)", async () => {
		const mockTxUpdate = vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		});
		const mockTxDelete = vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		});
		const mockTxSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		mockTransaction.mockImplementationOnce(async (cb) => {
			await cb({
				update: mockTxUpdate,
				delete: mockTxDelete,
				select: mockTxSelect,
			});
		});

		await executeAccountDeletion("user-1", []);

		expect(mockTransaction).toHaveBeenCalledTimes(1);
		// Should still soft-delete the user
		expect(mockTxUpdate).toHaveBeenCalled();
	});
});
