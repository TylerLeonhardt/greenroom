import { describe, expect, it, vi } from "vitest";

// Mock the db module
vi.mock("../../src/db/index.js", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => []),
						orderBy: vi.fn(() => []),
					})),
				})),
			})),
		})),
	},
}));

// Mock logger
vi.mock("~/services/logger.server", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

// Mock auth
vi.mock("~/services/auth.server", () => ({
	requireUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" }),
}));

// Mock groups service
vi.mock("~/services/groups.server", () => ({
	requireGroupMember: vi
		.fn()
		.mockResolvedValue({ id: "user-1", email: "test@test.com", name: "Test" }),
}));

// Mock events service
vi.mock("~/services/events.server", () => ({
	getEventWithAssignments: vi.fn(),
}));

import { getEventWithAssignments } from "~/services/events.server";
import { requireGroupMember } from "~/services/groups.server";
import { loader } from "./api.events.$eventId.ics";

describe("GET /api/events/:eventId/ics", () => {
	const mockEvent = {
		id: "event-1",
		groupId: "group-1",
		title: "Friday Night Show",
		description: "An amazing improv show",
		eventType: "show" as const,
		startTime: new Date("2026-03-15T19:00:00Z"),
		endTime: new Date("2026-03-15T21:00:00Z"),
		location: "Main Theater",
		callTime: new Date("2026-03-15T18:00:00Z"),
		createdById: "user-1",
		createdFromRequestId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		createdByName: "Admin User",
	};

	it("returns a valid .ics file for a regular event", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockEvent,
			assignments: [],
		});

		const request = new Request("http://localhost:5173/api/events/event-1/ics");
		const response = await loader({
			request,
			params: { eventId: "event-1" },
			context: {},
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
		expect(response.headers.get("Content-Disposition")).toContain(".ics");

		const body = await response.text();
		expect(body).toContain("BEGIN:VCALENDAR");
		expect(body).toContain("END:VCALENDAR");
		expect(body).toContain("BEGIN:VEVENT");
		expect(body).toContain("END:VEVENT");
		expect(body).toContain("SUMMARY:Friday Night Show");
		expect(body).toContain("DESCRIPTION:An amazing improv show");
		expect(body).toContain("LOCATION:Main Theater");
		// Regular viewer uses start_time (19:00Z)
		expect(body).toContain("DTSTART:20260315T190000Z");
		expect(body).toContain("DTEND:20260315T210000Z");
	});

	it("uses call time for performers at shows", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockEvent,
			assignments: [],
		});

		const request = new Request("http://localhost:5173/api/events/event-1/ics?role=Performer");
		const response = await loader({
			request,
			params: { eventId: "event-1" },
			context: {},
		});

		const body = await response.text();
		// Performer uses call_time (18:00Z)
		expect(body).toContain("DTSTART:20260315T180000Z");
		expect(body).toContain("DTEND:20260315T210000Z");
	});

	it("returns 404 for non-existent event", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const request = new Request("http://localhost:5173/api/events/nonexistent/ics");

		await expect(
			loader({ request, params: { eventId: "nonexistent" }, context: {} }),
		).rejects.toThrow();
	});

	it("escapes special characters in title", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: { ...mockEvent, title: "Show; with, special\\chars" },
			assignments: [],
		});

		const request = new Request("http://localhost:5173/api/events/event-1/ics");
		const response = await loader({
			request,
			params: { eventId: "event-1" },
			context: {},
		});

		const body = await response.text();
		expect(body).toContain("SUMMARY:Show\\; with\\, special\\\\chars");
	});

	it("handles events without description or location", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: {
				...mockEvent,
				description: null,
				location: null,
				callTime: null,
			},
			assignments: [],
		});

		const request = new Request("http://localhost:5173/api/events/event-1/ics");
		const response = await loader({
			request,
			params: { eventId: "event-1" },
			context: {},
		});

		const body = await response.text();
		expect(body).not.toContain("DESCRIPTION:");
		expect(body).not.toContain("LOCATION:");
		// Uses start_time when no call_time
		expect(body).toContain("DTSTART:20260315T190000Z");
	});

	it("does not use call time for non-show events even with Performer role", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: {
				...mockEvent,
				eventType: "rehearsal",
				callTime: new Date("2026-03-15T18:00:00Z"),
			},
			assignments: [],
		});

		const request = new Request("http://localhost:5173/api/events/event-1/ics?role=Performer");
		const response = await loader({
			request,
			params: { eventId: "event-1" },
			context: {},
		});

		const body = await response.text();
		// Rehearsal always uses start_time regardless of role
		expect(body).toContain("DTSTART:20260315T190000Z");
	});
	it("verifies group membership for the event", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockEvent,
			assignments: [],
		});

		const request = new Request("http://localhost:5173/api/events/event-1/ics");
		await loader({
			request,
			params: { eventId: "event-1" },
			context: {},
		});

		expect(requireGroupMember).toHaveBeenCalledWith(request, "group-1");
	});

	it("rejects non-members of the event group", async () => {
		(getEventWithAssignments as ReturnType<typeof vi.fn>).mockResolvedValue({
			event: mockEvent,
			assignments: [],
		});
		(requireGroupMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Response("Not Found", { status: 404 }),
		);

		const request = new Request("http://localhost:5173/api/events/event-1/ics");
		await expect(
			loader({ request, params: { eventId: "event-1" }, context: {} }),
		).rejects.toThrow();
	});
});
