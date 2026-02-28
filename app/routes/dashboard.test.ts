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

vi.mock("~/services/dashboard.server", () => ({
	getDashboardData: vi.fn().mockResolvedValue({
		groups: [
			{
				id: "group-1",
				name: "Test Group",
				description: "A test group",
				inviteCode: "ABCD1234",
				createdById: "user-1",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				role: "admin",
				memberCount: 5,
			},
			{
				id: "group-2",
				name: "Another Group",
				description: null,
				inviteCode: "EFGH5678",
				createdById: "user-2",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				role: "member",
				memberCount: 3,
			},
		],
		upcomingEvents: [],
		pendingRequests: [],
		pendingConfirmations: [],
	}),
}));

import { getDashboardData } from "~/services/dashboard.server";
import { loader } from "./dashboard";

describe("dashboard loader", () => {
	it("returns groups with correct member counts", async () => {
		const request = new Request("http://localhost/dashboard");
		const result = await loader({ request, params: {}, context: {} });

		expect(getDashboardData).toHaveBeenCalledWith("user-1");
		expect(result.groups).toHaveLength(2);
		expect(result.groups[0].memberCount).toBe(5);
		expect(result.groups[1].memberCount).toBe(3);
	});

	it("passes through member count from service layer unchanged", async () => {
		const request = new Request("http://localhost/dashboard");
		const result = await loader({ request, params: {}, context: {} });

		// Verifies the loader preserves memberCount from the service layer.
		// The actual SQL fix (correlated subquery instead of window function)
		// is in getDashboardData — tested via manual verification against DB.
		expect(result.groups[0].memberCount).toBe(5);
		expect(result.groups[1].memberCount).toBe(3);
	});
});
