import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.server.js", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("./telemetry.server.js", () => ({
	trackEvent: vi.fn(),
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", mockFetch);

import { sendBatchEventsCreatedWebhook } from "~/services/webhook.server";

describe("sendBatchEventsCreatedWebhook", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockResolvedValue({ ok: true });
	});

	it("sends webhook with correct embed title for multiple events", async () => {
		sendBatchEventsCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Test Group",
			title: "Weekly Rehearsals",
			eventType: "rehearsal",
			events: [
				{ dateTime: "Wed, Mar 15 · 7:00 PM – 9:00 PM" },
				{ dateTime: "Thu, Mar 16 · 7:00 PM – 9:00 PM" },
				{ dateTime: "Fri, Mar 17 · 7:00 PM – 9:00 PM" },
			],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		// sendWebhook is fire-and-forget (void), give it a tick to execute
		await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

		const fetchCall = mockFetch.mock.calls[0];
		const body = JSON.parse(fetchCall[1].body);
		const embed = body.embeds[0];

		expect(embed.title).toBe("🎭 3 New Rehearsals: Weekly Rehearsals");
		expect(embed.url).toBe("http://localhost:5173/groups/g1/events");
	});

	it("formats event schedule list with numbered entries", async () => {
		sendBatchEventsCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Test Group",
			title: "Shows",
			eventType: "show",
			events: [
				{ dateTime: "Fri, Mar 15 · 8:00 PM – 10:00 PM", location: "Main Stage" },
				{ dateTime: "Sat, Mar 16 · 8:00 PM – 10:00 PM", location: "Club Room" },
			],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		const scheduleField = body.embeds[0].fields.find(
			(f: { name: string }) => f.name === "Schedule",
		);

		expect(scheduleField.value).toContain("1. Fri, Mar 15 · 8:00 PM – 10:00 PM · Main Stage");
		expect(scheduleField.value).toContain("2. Sat, Mar 16 · 8:00 PM – 10:00 PM · Club Room");
	});

	it("uses singular form for single event", async () => {
		sendBatchEventsCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Test Group",
			title: "Big Show",
			eventType: "show",
			events: [{ dateTime: "Fri, Mar 15 · 8:00 PM – 10:00 PM" }],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.embeds[0].title).toBe("🎭 1 New Show: Big Show");
	});

	it("omits location from schedule when not provided", async () => {
		sendBatchEventsCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Test Group",
			title: "Rehearsal",
			eventType: "rehearsal",
			events: [{ dateTime: "Wed, Mar 15 · 7:00 PM – 9:00 PM" }],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		const scheduleField = body.embeds[0].fields.find(
			(f: { name: string }) => f.name === "Schedule",
		);

		// Should just have datetime, no " · " location suffix
		expect(scheduleField.value).toBe("1. Wed, Mar 15 · 7:00 PM – 9:00 PM");
	});

	it("includes group name and type fields", async () => {
		sendBatchEventsCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Improv Squad",
			title: "Sessions",
			eventType: "other",
			events: [{ dateTime: "Mon, Mar 20 · 6:00 PM – 8:00 PM" }],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		const fields = body.embeds[0].fields;
		const groupField = fields.find((f: { name: string }) => f.name === "Group");
		const typeField = fields.find((f: { name: string }) => f.name === "Type");

		expect(groupField.value).toBe("Improv Squad");
		expect(groupField.inline).toBe(true);
		expect(typeField.value).toBe("Other");
		expect(typeField.inline).toBe(true);
	});

	it("includes footer text", async () => {
		sendBatchEventsCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Test Group",
			title: "Test",
			eventType: "rehearsal",
			events: [{ dateTime: "Wed, Mar 15 · 7:00 PM" }],
			eventsUrl: "http://localhost:5173/groups/g1/events",
		});

		await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.embeds[0].footer.text).toBe("View details on My Call Time");
	});
});
