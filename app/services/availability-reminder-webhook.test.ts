import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.server.js", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

vi.mock("./telemetry.server.js", () => ({
	trackEvent: vi.fn(),
}));

import { sendAvailabilityReminderWebhook } from "./webhook.server";

describe("sendAvailabilityReminderWebhook", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("sends correct Discord embed with reminder title and non-respondent names", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

		sendAvailabilityReminderWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Comedy Club",
			title: "March Rehearsal Availability",
			nonRespondentNames: ["Bob", "Carol", "Dave"],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

		const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
		const embed = body.embeds[0];

		expect(embed.title).toBe("🔔 Availability Reminder: March Rehearsal Availability");
		expect(embed.description).toBe("**3** members still need to respond");
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "Group", value: "Comedy Club" }),
				expect.objectContaining({ name: "Waiting on", value: "Bob, Carol, Dave" }),
			]),
		);
	});

	it("truncates name list when more than 10 non-respondents", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

		const names = Array.from({ length: 13 }, (_, i) => `Member${i + 1}`);

		sendAvailabilityReminderWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Big Group",
			title: "April Availability",
			nonRespondentNames: names,
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

		const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
		const embed = body.embeds[0];

		const waitingOnField = embed.fields.find((f: { name: string }) => f.name === "Waiting on");
		expect(waitingOnField.value).toContain("and 3 more");
		expect(waitingOnField.value).not.toContain("Member11");
		expect(embed.description).toBe("**13** members still need to respond");
	});

	it("handles single non-respondent (singular grammar)", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

		sendAvailabilityReminderWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Small Group",
			title: "May Availability",
			nonRespondentNames: ["Alice"],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

		const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
		const embed = body.embeds[0];

		expect(embed.description).toBe("**1** member still needs to respond");
	});

	it("includes request URL in embed", async () => {
		vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

		sendAvailabilityReminderWebhook("https://discord.com/api/webhooks/123/abc", {
			groupName: "Test Group",
			title: "June Availability",
			nonRespondentNames: ["Bob"],
			requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
		});

		await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

		const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
		const embed = body.embeds[0];

		expect(embed.url).toBe("https://mycalltime.app/groups/g1/availability/r1");
	});
});
