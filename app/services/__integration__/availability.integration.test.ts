/**
 * Integration tests for app/services/availability.server.ts
 *
 * These tests run against a real PostgreSQL database (greenroom_test).
 * Prerequisites: Docker Compose Postgres running on port 5432.
 * Run with: pnpm test:integration
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
	closeAvailabilityRequest,
	createAvailabilityRequest,
	deleteAvailabilityRequest,
	getAggregatedResults,
	getAvailabilityRequest,
	getGroupAvailabilityRequests,
	getOpenAvailabilityRequestCount,
	getRequestResponses,
	getUserResponse,
	reopenAvailabilityRequest,
	submitAvailabilityResponse,
} from "../availability.server.js";
import { createEvent } from "../events.server.js";
import {
	addGroupMember,
	createTestAvailabilityRequest,
	createTestAvailabilityResponse,
	createTestGroup,
	createTestUser,
} from "./seed.js";
import { cleanDatabase } from "./setup.js";

beforeEach(async () => {
	await cleanDatabase();
});

describe("availability.server integration", () => {
	// --- createAvailabilityRequest ---

	describe("createAvailabilityRequest", () => {
		it("inserts a request with all fields", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const request = await createAvailabilityRequest({
				groupId: group.id,
				title: "  March Availability  ",
				description: "  When are you free?  ",
				dateRangeStart: new Date("2026-03-01T00:00:00Z"),
				dateRangeEnd: new Date("2026-03-31T00:00:00Z"),
				requestedDates: ["2026-03-15", "2026-03-16", "2026-03-17"],
				createdById: user.id,
				requestedStartTime: "19:00",
				requestedEndTime: "21:00",
			});

			expect(request.id).toBeDefined();
			expect(request.groupId).toBe(group.id);
			expect(request.title).toBe("March Availability"); // trimmed
			expect(request.description).toBe("When are you free?"); // trimmed
			expect(request.requestedDates).toEqual(["2026-03-15", "2026-03-16", "2026-03-17"]);
			expect(request.requestedStartTime).toBe("19:00");
			expect(request.requestedEndTime).toBe("21:00");
			expect(request.status).toBe("open"); // default
			expect(request.createdById).toBe(user.id);
		});

		it("sets optional fields to null when not provided", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const request = await createAvailabilityRequest({
				groupId: group.id,
				title: "Basic Request",
				dateRangeStart: new Date("2026-04-01T00:00:00Z"),
				dateRangeEnd: new Date("2026-04-07T00:00:00Z"),
				requestedDates: ["2026-04-01"],
				createdById: user.id,
			});

			expect(request.description).toBeNull();
			expect(request.requestedStartTime).toBeNull();
			expect(request.requestedEndTime).toBeNull();
			expect(request.expiresAt).toBeNull();
		});
	});

	// --- getAvailabilityRequest ---

	describe("getAvailabilityRequest", () => {
		it("returns request with creator name", async () => {
			const user = await createTestUser({ name: "Jane Creator" });
			const group = await createTestGroup(user.id);
			const request = await createTestAvailabilityRequest(group.id, user.id, {
				title: "Team Poll",
			});

			const result = await getAvailabilityRequest(request.id);
			expect(result).not.toBeNull();
			expect(result?.title).toBe("Team Poll");
			expect(result?.createdByName).toBe("Jane Creator");
		});

		it("returns 'Deleted user' when creator is null", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const request = await createTestAvailabilityRequest(group.id, user.id);

			// Simulate creator deletion (FK ON DELETE SET NULL)
			const { db } = await import("../../../src/db/index.js");
			const { availabilityRequests } = await import("../../../src/db/schema.js");
			const { eq } = await import("drizzle-orm");
			await db
				.update(availabilityRequests)
				.set({ createdById: null })
				.where(eq(availabilityRequests.id, request.id));

			const result = await getAvailabilityRequest(request.id);
			expect(result?.createdByName).toBe("Deleted user");
		});

		it("returns null for non-existent request", async () => {
			const result = await getAvailabilityRequest("00000000-0000-0000-0000-000000000000");
			expect(result).toBeNull();
		});
	});

	// --- getGroupAvailabilityRequests ---

	describe("getGroupAvailabilityRequests", () => {
		it("returns requests for the specified group with counts", async () => {
			const admin = await createTestUser({ name: "Admin" });
			const member = await createTestUser({ name: "Member" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);

			const request = await createTestAvailabilityRequest(group.id, admin.id);
			await createTestAvailabilityResponse(request.id, member.id, {
				"2026-04-01": "available",
			});

			const results = await getGroupAvailabilityRequests(group.id);
			expect(results).toHaveLength(1);
			expect(results[0].responseCount).toBe(1);
			expect(results[0].memberCount).toBe(2); // admin + member
			expect(results[0].createdByName).toBe("Admin");
		});

		it("sorts open requests before closed, then by createdAt descending", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const req1 = await createTestAvailabilityRequest(group.id, user.id, {
				title: "First (will close)",
			});
			// Small delay to ensure different createdAt
			await new Promise((r) => setTimeout(r, 50));
			const _req2 = await createTestAvailabilityRequest(group.id, user.id, {
				title: "Second (open)",
			});
			await new Promise((r) => setTimeout(r, 50));
			const _req3 = await createTestAvailabilityRequest(group.id, user.id, {
				title: "Third (open)",
			});

			await closeAvailabilityRequest(req1.id);

			const results = await getGroupAvailabilityRequests(group.id);
			expect(results).toHaveLength(3);
			// Open first (newest first)
			expect(results[0].title).toBe("Third (open)");
			expect(results[1].title).toBe("Second (open)");
			// Closed last
			expect(results[2].title).toBe("First (will close)");
		});

		it("does not return requests from other groups", async () => {
			const user = await createTestUser();
			const g1 = await createTestGroup(user.id, { name: "Group 1" });
			const g2 = await createTestGroup(user.id, { name: "Group 2" });

			await createTestAvailabilityRequest(g1.id, user.id, { title: "G1 Request" });
			await createTestAvailabilityRequest(g2.id, user.id, { title: "G2 Request" });

			const results = await getGroupAvailabilityRequests(g1.id);
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("G1 Request");
		});
	});

	// --- submitAvailabilityResponse / getUserResponse ---

	describe("submitAvailabilityResponse", () => {
		it("creates a new response", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);
			const request = await createTestAvailabilityRequest(group.id, admin.id);

			await submitAvailabilityResponse({
				requestId: request.id,
				userId: member.id,
				responses: {
					"2026-04-01": "available",
					"2026-04-02": "maybe",
					"2026-04-03": "not_available",
				},
			});

			const response = await getUserResponse(request.id, member.id);
			expect(response).toEqual({
				"2026-04-01": "available",
				"2026-04-02": "maybe",
				"2026-04-03": "not_available",
			});
		});

		it("upserts — overwrites previous response", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);
			const request = await createTestAvailabilityRequest(group.id, admin.id);

			// First response
			await submitAvailabilityResponse({
				requestId: request.id,
				userId: member.id,
				responses: { "2026-04-01": "not_available" },
			});

			// Updated response
			await submitAvailabilityResponse({
				requestId: request.id,
				userId: member.id,
				responses: { "2026-04-01": "available", "2026-04-02": "maybe" },
			});

			const response = await getUserResponse(request.id, member.id);
			expect(response).toEqual({
				"2026-04-01": "available",
				"2026-04-02": "maybe",
			});
		});
	});

	describe("getUserResponse", () => {
		it("returns null when user has not responded", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const request = await createTestAvailabilityRequest(group.id, user.id);

			const response = await getUserResponse(request.id, user.id);
			expect(response).toBeNull();
		});
	});

	// --- getRequestResponses ---

	describe("getRequestResponses", () => {
		it("returns all responses with user names, sorted by name", async () => {
			const admin = await createTestUser({ name: "Admin" });
			const zara = await createTestUser({ name: "Zara" });
			const alice = await createTestUser({ name: "Alice" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, zara.id);
			await addGroupMember(group.id, alice.id);

			const request = await createTestAvailabilityRequest(group.id, admin.id);
			await createTestAvailabilityResponse(request.id, zara.id, {
				"2026-04-01": "available",
			});
			await createTestAvailabilityResponse(request.id, alice.id, {
				"2026-04-01": "maybe",
			});

			const results = await getRequestResponses(request.id);
			expect(results).toHaveLength(2);
			expect(results[0].userName).toBe("Alice"); // sorted
			expect(results[1].userName).toBe("Zara");
		});
	});

	// --- getAggregatedResults ---

	describe("getAggregatedResults", () => {
		it("aggregates responses with correct scoring", async () => {
			const admin = await createTestUser({ name: "Admin" });
			const m1 = await createTestUser({ name: "Member 1" });
			const m2 = await createTestUser({ name: "Member 2" });
			const m3 = await createTestUser({ name: "Member 3" });
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, m1.id);
			await addGroupMember(group.id, m2.id);
			await addGroupMember(group.id, m3.id);

			const request = await createTestAvailabilityRequest(group.id, admin.id, {
				requestedDates: ["2026-04-01", "2026-04-02"],
			});

			// m1: available both days
			await createTestAvailabilityResponse(request.id, m1.id, {
				"2026-04-01": "available",
				"2026-04-02": "available",
			});
			// m2: maybe day 1, not available day 2
			await createTestAvailabilityResponse(request.id, m2.id, {
				"2026-04-01": "maybe",
				"2026-04-02": "not_available",
			});
			// m3 and admin don't respond

			const results = await getAggregatedResults(request.id);
			expect(results.totalMembers).toBe(4); // admin + 3 members
			expect(results.totalResponded).toBe(2);
			expect(results.dates).toHaveLength(2);

			// Day 1: 1 available (2pts) + 1 maybe (1pt) = score 3
			const day1 = results.dates[0];
			expect(day1.date).toBe("2026-04-01");
			expect(day1.available).toBe(1);
			expect(day1.maybe).toBe(1);
			expect(day1.notAvailable).toBe(0);
			expect(day1.noResponse).toBe(2); // admin + m3
			expect(day1.score).toBe(3);
			expect(day1.total).toBe(4);

			// Day 2: 1 available (2pts) + 0 maybe = score 2
			const day2 = results.dates[1];
			expect(day2.available).toBe(1);
			expect(day2.notAvailable).toBe(1);
			expect(day2.noResponse).toBe(2);
			expect(day2.score).toBe(2);
		});

		it("handles zero responses gracefully", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const request = await createTestAvailabilityRequest(group.id, user.id, {
				requestedDates: ["2026-04-01"],
			});

			const results = await getAggregatedResults(request.id);
			expect(results.totalResponded).toBe(0);
			expect(results.dates[0].noResponse).toBe(1); // just the admin
			expect(results.dates[0].score).toBe(0);
		});

		it("throws for non-existent request", async () => {
			await expect(getAggregatedResults("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
				"Request not found.",
			);
		});
	});

	// --- close / reopen ---

	describe("closeAvailabilityRequest / reopenAvailabilityRequest", () => {
		it("toggles request status between open and closed", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const request = await createTestAvailabilityRequest(group.id, user.id);

			expect((await getAvailabilityRequest(request.id))?.status).toBe("open");

			await closeAvailabilityRequest(request.id);
			expect((await getAvailabilityRequest(request.id))?.status).toBe("closed");

			await reopenAvailabilityRequest(request.id);
			expect((await getAvailabilityRequest(request.id))?.status).toBe("open");
		});
	});

	describe("getOpenAvailabilityRequestCount", () => {
		it("counts only open requests for the group", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);

			const req1 = await createTestAvailabilityRequest(group.id, user.id);
			await createTestAvailabilityRequest(group.id, user.id);
			await closeAvailabilityRequest(req1.id);

			expect(await getOpenAvailabilityRequestCount(group.id)).toBe(1);
		});
	});

	// --- deleteAvailabilityRequest ---

	describe("deleteAvailabilityRequest", () => {
		it("deletes the request and cascades to responses", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const group = await createTestGroup(admin.id);
			await addGroupMember(group.id, member.id);

			const request = await createTestAvailabilityRequest(group.id, admin.id);
			await createTestAvailabilityResponse(request.id, member.id, {
				"2026-04-01": "available",
			});

			await deleteAvailabilityRequest(request.id);

			const result = await getAvailabilityRequest(request.id);
			expect(result).toBeNull();
		});

		it("unlinks events that were created from this request", async () => {
			const user = await createTestUser();
			const group = await createTestGroup(user.id);
			const request = await createTestAvailabilityRequest(group.id, user.id);

			const event = await createEvent({
				groupId: group.id,
				title: "From Request",
				eventType: "rehearsal",
				startTime: new Date("2026-04-01T19:00:00Z"),
				endTime: new Date("2026-04-01T21:00:00Z"),
				createdById: user.id,
				createdFromRequestId: request.id,
			});

			await deleteAvailabilityRequest(request.id);

			// Event should still exist but with null createdFromRequestId
			const { getEventWithAssignments } = await import("../events.server.js");
			const eventResult = await getEventWithAssignments(event.id);
			expect(eventResult).not.toBeNull();
			expect(eventResult?.event.createdFromRequestId).toBeNull();
		});
	});
});
