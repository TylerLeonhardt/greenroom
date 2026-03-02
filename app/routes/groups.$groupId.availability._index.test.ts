import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock groups service
vi.mock("~/services/groups.server", () => ({
	requireGroupMember: vi.fn().mockResolvedValue({
		id: "user-1",
		email: "test@example.com",
		name: "Test User",
		profileImage: null,
	}),
}));

// Mock availability service
vi.mock("~/services/availability.server", () => ({
	getGroupAvailabilityRequests: vi.fn().mockResolvedValue([]),
}));

import { loader } from "~/routes/groups.$groupId.availability._index";
import { getGroupAvailabilityRequests } from "~/services/availability.server";
import { requireGroupMember } from "~/services/groups.server";

describe("availability index loader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(getGroupAvailabilityRequests as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	it("requires group membership", async () => {
		const request = new Request("http://localhost/groups/g1/availability");
		await loader({ request, params: { groupId: "g1" }, context: {} });
		expect(requireGroupMember).toHaveBeenCalledWith(request, "g1");
	});

	it("returns availability requests", async () => {
		const mockRequests = [
			{
				id: "r1",
				title: "March Rehearsals",
				status: "open",
				dateRangeStart: new Date("2026-03-01"),
				dateRangeEnd: new Date("2026-03-28"),
				requestedStartTime: "19:00",
				requestedEndTime: "21:00",
				memberCount: 8,
				responseCount: 5,
				createdByName: "Admin User",
			},
		];
		(getGroupAvailabilityRequests as ReturnType<typeof vi.fn>).mockResolvedValue(mockRequests);

		const request = new Request("http://localhost/groups/g1/availability");
		const result = await loader({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({ requests: mockRequests });
	});

	it("passes groupId to getGroupAvailabilityRequests", async () => {
		const request = new Request("http://localhost/groups/group-xyz/availability");
		await loader({ request, params: { groupId: "group-xyz" }, context: {} });
		expect(getGroupAvailabilityRequests).toHaveBeenCalledWith("group-xyz");
	});

	it("defaults to empty groupId when param is missing", async () => {
		const request = new Request("http://localhost/groups//availability");
		await loader({ request, params: {}, context: {} });
		expect(requireGroupMember).toHaveBeenCalledWith(request, "");
	});
});
