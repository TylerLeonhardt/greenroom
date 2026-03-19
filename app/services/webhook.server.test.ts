import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the module
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

import { logger } from "./logger.server.js";
import { trackEvent } from "./telemetry.server.js";
import {
	isValidWebhookUrl,
	sendAvailabilityRequestWebhook,
	sendEventCreatedWebhook,
	sendEventEditedWebhook,
	sendEventReminderWebhook,
	sendTestWebhook,
	sendWebhook,
} from "./webhook.server";

describe("webhook.server", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.clearAllMocks();
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// --- URL Validation ---

	describe("isValidWebhookUrl", () => {
		it("accepts discord.com webhook URLs", () => {
			expect(isValidWebhookUrl("https://discord.com/api/webhooks/123/abc")).toBe(true);
		});

		it("accepts discordapp.com webhook URLs", () => {
			expect(isValidWebhookUrl("https://discordapp.com/api/webhooks/123/abc")).toBe(true);
		});

		it("rejects non-Discord URLs", () => {
			expect(isValidWebhookUrl("https://example.com/webhook")).toBe(false);
		});

		it("rejects empty strings", () => {
			expect(isValidWebhookUrl("")).toBe(false);
		});

		it("rejects URLs that look similar but aren't Discord webhooks", () => {
			expect(isValidWebhookUrl("https://discord.com/channels/123")).toBe(false);
			expect(isValidWebhookUrl("https://notdiscord.com/api/webhooks/123")).toBe(false);
		});
	});

	// --- sendWebhook ---

	describe("sendWebhook", () => {
		it("sends correct Discord embed payload", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			const result = await sendWebhook(
				"https://discord.com/api/webhooks/123/abc",
				{ title: "Test", description: "Hello" },
				{ groupId: "g1", type: "test" },
			);

			expect(result).toBe(true);
			expect(globalThis.fetch).toHaveBeenCalledWith("https://discord.com/api/webhooks/123/abc", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					embeds: [{ color: 0x57f287, title: "Test", description: "Hello" }],
				}),
			});
		});

		it("tracks event on success", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			await sendWebhook(
				"https://discord.com/api/webhooks/123/abc",
				{ title: "Test" },
				{ groupId: "g1", type: "test" },
			);

			expect(trackEvent).toHaveBeenCalledWith("WebhookSent", {
				groupId: "g1",
				type: "test",
			});
		});

		it("returns false and logs warning on non-OK response", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response("error", { status: 400 }));

			const result = await sendWebhook(
				"https://discord.com/api/webhooks/123/abc",
				{ title: "Test" },
				{ groupId: "g1", type: "test" },
			);

			expect(result).toBe(false);
			expect(logger.warn).toHaveBeenCalled();
			expect(trackEvent).not.toHaveBeenCalled();
		});

		it("returns false and logs error on network failure", async () => {
			vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network error"));

			const result = await sendWebhook(
				"https://discord.com/api/webhooks/123/abc",
				{ title: "Test" },
				{ groupId: "g1", type: "test" },
			);

			expect(result).toBe(false);
			expect(logger.error).toHaveBeenCalled();
			expect(trackEvent).not.toHaveBeenCalled();
		});

		it("never throws even on unexpected errors", async () => {
			vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError("Invalid URL"));

			const result = await sendWebhook("bad-url", { title: "Test" });

			expect(result).toBe(false);
		});
	});

	// --- Notification Helpers ---

	describe("sendAvailabilityRequestWebhook", () => {
		it("sends Discord embed with availability request details", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendAvailabilityRequestWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Comedy Club",
				title: "March Rehearsal Availability",
				createdByName: "Alice",
				dateRange: "Mar 1 – Mar 15",
				requestUrl: "https://mycalltime.app/groups/g1/availability/r1",
			});

			// Wait for fire-and-forget
			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];

			expect(embed.title).toBe("📋 New Availability Request");
			expect(embed.description).toBe("**March Rehearsal Availability**");
			expect(embed.url).toBe("https://mycalltime.app/groups/g1/availability/r1");
			expect(embed.fields).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: "Group", value: "Comedy Club" }),
					expect.objectContaining({ name: "Date Range", value: "Mar 1 – Mar 15" }),
					expect.objectContaining({ name: "Created By", value: "Alice" }),
				]),
			);
		});
	});

	describe("sendEventCreatedWebhook", () => {
		it("sends Discord embed with event details", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Friday Show",
				eventType: "show",
				dateTime: "Fri, Mar 7 · 8:00 PM – 10:00 PM",
				location: "Main Stage",
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];

			expect(embed.title).toBe("🎭 New Show: Friday Show");
			expect(embed.fields).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: "Where", value: "Main Stage" }),
					expect.objectContaining({
						name: "When",
						value: "Fri, Mar 7 · 8:00 PM – 10:00 PM",
					}),
				]),
			);
		});

		it("omits location field when not provided", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Rehearsal",
				eventType: "rehearsal",
				dateTime: "Mon, Mar 3 · 7:00 PM – 9:00 PM",
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];

			expect(embed.fields.find((f: { name: string }) => f.name === "Where")).toBeUndefined();
		});

		it("includes call time field when callTime is provided", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Friday Show",
				eventType: "show",
				dateTime: "Fri, Mar 7 · 8:00 PM – 10:00 PM",
				callTime: "7:00 PM (PST)",
				location: "Main Stage",
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).toContain("Call Time");
			const callTimeField = embed.fields.find((f: { name: string }) => f.name === "Call Time");
			expect(callTimeField.value).toBe("7:00 PM (PST)");
		});

		it("omits call time field when callTime is not provided", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Rehearsal",
				eventType: "rehearsal",
				dateTime: "Mon, Mar 3 · 7:00 PM – 9:00 PM",
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).not.toContain("Call Time");
		});

		it("omits call time field when callTime is null", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventCreatedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Rehearsal",
				eventType: "rehearsal",
				dateTime: "Mon, Mar 3 · 7:00 PM – 9:00 PM",
				callTime: null,
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).not.toContain("Call Time");
		});
	});

	describe("sendEventReminderWebhook", () => {
		it("sends Discord embed with reminder details", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventReminderWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Saturday Show",
				dateTime: "Sat, Mar 8 · 8:00 PM – 10:00 PM",
				location: "Theater",
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];

			expect(embed.title).toBe("⏰ Reminder: Saturday Show");
			expect(embed.description).toContain("less than 24 hours");
		});

		it("includes call time field when callTime is provided", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventReminderWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Saturday Show",
				dateTime: "Sat, Mar 8 · 8:00 PM – 10:00 PM",
				callTime: "7:00 PM (PST)",
				location: "Theater",
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).toContain("Call Time");
			const callTimeField = embed.fields.find((f: { name: string }) => f.name === "Call Time");
			expect(callTimeField.value).toBe("7:00 PM (PST)");
		});

		it("omits call time field when callTime is not provided", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventReminderWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Rehearsal",
				dateTime: "Sat, Mar 8 · 8:00 PM – 10:00 PM",
				location: "Studio",
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).not.toContain("Call Time");
		});

		it("omits call time field when callTime is null", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventReminderWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Rehearsal",
				dateTime: "Sat, Mar 8 · 8:00 PM – 10:00 PM",
				callTime: null,
				location: "Studio",
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).not.toContain("Call Time");
		});
	});

	describe("sendEventEditedWebhook", () => {
		it("sends Discord embed with event edit details", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventEditedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Friday Show",
				eventType: "show",
				dateTime: "Fri, Mar 7 · 8:00 PM – 10:00 PM (PST)",
				location: "Main Stage",
				changes: ["Time changed", "Location changed"],
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];

			expect(embed.title).toBe("✏️ Updated Show: Friday Show");
			expect(embed.fields).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: "Where", value: "Main Stage" }),
					expect.objectContaining({ name: "Changes", value: "• Time changed\n• Location changed" }),
				]),
			);
		});

		it("includes call time field when callTime is provided", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventEditedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Friday Show",
				eventType: "show",
				dateTime: "Fri, Mar 7 · 8:00 PM – 10:00 PM (PST)",
				callTime: "7:00 PM (PST)",
				location: "Main Stage",
				changes: ["Call time changed"],
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).toContain("Call Time");
			const callTimeField = embed.fields.find((f: { name: string }) => f.name === "Call Time");
			expect(callTimeField.value).toBe("7:00 PM (PST)");
		});

		it("omits call time field when callTime is not provided", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventEditedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Rehearsal",
				eventType: "rehearsal",
				dateTime: "Mon, Mar 3 · 7:00 PM – 9:00 PM (PST)",
				changes: ["Title changed"],
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).not.toContain("Call Time");
		});

		it("omits call time field when callTime is null", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			sendEventEditedWebhook("https://discord.com/api/webhooks/123/abc", {
				groupName: "Troupe",
				eventTitle: "Rehearsal",
				eventType: "rehearsal",
				dateTime: "Mon, Mar 3 · 7:00 PM – 9:00 PM (PST)",
				callTime: null,
				changes: ["Title changed"],
				eventUrl: "https://mycalltime.app/groups/g1/events/e1",
			});

			await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			const embed = body.embeds[0];
			const fieldNames = embed.fields.map((f: { name: string }) => f.name);

			expect(fieldNames).not.toContain("Call Time");
		});
	});

	describe("sendTestWebhook", () => {
		it("awaits and returns true on success", async () => {
			vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

			const result = await sendTestWebhook("https://discord.com/api/webhooks/123/abc", "My Group");

			expect(result).toBe(true);
			const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as string);
			expect(body.embeds[0].title).toBe("✅ Webhook Connected!");
			expect(body.embeds[0].description).toContain("My Group");
		});

		it("returns false on failure", async () => {
			vi.mocked(globalThis.fetch).mockRejectedValue(new Error("fail"));

			const result = await sendTestWebhook("https://discord.com/api/webhooks/123/abc", "My Group");

			expect(result).toBe(false);
		});
	});
});
