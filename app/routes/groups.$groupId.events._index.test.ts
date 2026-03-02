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

// Mock events service
vi.mock("~/services/events.server", () => ({
	getGroupEvents: vi.fn().mockResolvedValue([]),
}));

import { loader } from "~/routes/groups.$groupId.events._index";
import { getGroupEvents } from "~/services/events.server";
import { requireGroupMember } from "~/services/groups.server";

describe("events index loader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireGroupMember as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			email: "test@example.com",
			name: "Test User",
			profileImage: null,
		});
		(getGroupEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	it("requires group membership", async () => {
		const request = new Request("http://localhost/groups/g1/events");
		await loader({ request, params: { groupId: "g1" }, context: {} });
		expect(requireGroupMember).toHaveBeenCalledWith(request, "g1");
	});

	it("returns events and userId", async () => {
		const mockEvents = [
			{
				id: "e1",
				title: "Show Night",
				eventType: "show",
				startTime: new Date("2026-03-15T19:00:00Z"),
				endTime: new Date("2026-03-15T21:00:00Z"),
				location: "Theater",
				assignmentCount: 5,
				confirmedCount: 3,
			},
		];
		(getGroupEvents as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

		const request = new Request("http://localhost/groups/g1/events");
		const result = await loader({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({ events: mockEvents, userId: "user-1" });
	});

	it("passes groupId to getGroupEvents", async () => {
		const request = new Request("http://localhost/groups/group-abc/events");
		await loader({ request, params: { groupId: "group-abc" }, context: {} });
		expect(getGroupEvents).toHaveBeenCalledWith("group-abc");
	});

	it("defaults to empty groupId when param is missing", async () => {
		const request = new Request("http://localhost/groups//events");
		await loader({ request, params: {}, context: {} });
		expect(requireGroupMember).toHaveBeenCalledWith(request, "");
	});
});
