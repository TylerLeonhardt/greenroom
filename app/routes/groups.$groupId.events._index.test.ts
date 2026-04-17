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
	confirmAllPendingEventsInGroup: vi.fn().mockResolvedValue({ confirmedCount: 0, eventIds: [] }),
}));

// Mock availability service
vi.mock("~/services/availability.server", () => ({
	getAvailabilityRequest: vi.fn().mockResolvedValue(null),
}));

// Mock CSRF service
vi.mock("~/services/csrf.server", () => ({
	validateCsrfToken: vi.fn().mockResolvedValue(undefined),
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

	it("returns events, userId, pendingCount, and pendingRequestTitle", async () => {
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
				userStatus: null,
			},
		];
		(getGroupEvents as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

		const request = new Request("http://localhost/groups/g1/events");
		const result = await loader({ request, params: { groupId: "g1" }, context: {} });
		expect(result).toEqual({
			events: mockEvents,
			userId: "user-1",
			pendingCount: 0,
			pendingRequestTitle: null,
		});
	});

	it("passes groupId and userId to getGroupEvents", async () => {
		const request = new Request("http://localhost/groups/group-abc/events");
		await loader({ request, params: { groupId: "group-abc" }, context: {} });
		expect(getGroupEvents).toHaveBeenCalledWith("group-abc", { userId: "user-1" });
	});

	it("defaults to empty groupId when param is missing", async () => {
		const request = new Request("http://localhost/groups//events");
		await loader({ request, params: {}, context: {} });
		expect(requireGroupMember).toHaveBeenCalledWith(request, "");
	});

	it("counts pending upcoming events for the banner", async () => {
		const futureDate = new Date(Date.now() + 86400000).toISOString();
		const mockEvents = [
			{
				id: "e1",
				title: "Event 1",
				eventType: "rehearsal",
				startTime: futureDate,
				endTime: futureDate,
				userStatus: "pending",
				createdFromRequestId: null,
			},
			{
				id: "e2",
				title: "Event 2",
				eventType: "rehearsal",
				startTime: futureDate,
				endTime: futureDate,
				userStatus: "confirmed",
				createdFromRequestId: null,
			},
		];
		(getGroupEvents as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

		const request = new Request("http://localhost/groups/g1/events");
		const result = await loader({ request, params: { groupId: "g1" }, context: {} });
		expect(result.pendingCount).toBe(1);
		expect(result.pendingRequestTitle).toBeNull();
	});
});
