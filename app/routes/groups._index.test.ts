import { describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
		timezone: null,
	}),
}));

vi.mock("~/services/groups.server", () => ({
	getUserGroups: vi.fn().mockResolvedValue([
		{
			id: "group-1",
			name: "Improv Team",
			description: "Our improv group",
			inviteCode: "ABCD1234",
			createdById: "user-1",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			role: "admin",
			memberCount: 7,
		},
		{
			id: "group-2",
			name: "Comedy Club",
			description: null,
			inviteCode: "EFGH5678",
			createdById: "user-2",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			role: "member",
			memberCount: 12,
		},
	]),
	createGroup: vi.fn(),
	joinGroup: vi.fn(),
}));

// Mock CSRF validation — allow all by default
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
}));

import { getUserGroups } from "~/services/groups.server";
import { loader } from "./groups._index";

describe("groups loader", () => {
	it("returns groups with correct member counts", async () => {
		const request = new Request("http://localhost/groups");
		const result = await loader({ request, params: {}, context: {} });

		expect(getUserGroups).toHaveBeenCalledWith("user-1");
		expect(result.groups).toHaveLength(2);
		expect(result.groups[0].memberCount).toBe(7);
		expect(result.groups[1].memberCount).toBe(12);
	});

	it("passes through member count from service layer unchanged", async () => {
		const request = new Request("http://localhost/groups");
		const result = await loader({ request, params: {}, context: {} });

		// Verifies the loader preserves memberCount from the service layer.
		// The actual SQL fix (correlated subquery instead of window function)
		// is in getUserGroups — tested via manual verification against DB.
		expect(result.groups[0].memberCount).toBe(7);
		expect(result.groups[1].memberCount).toBe(12);
	});
});
