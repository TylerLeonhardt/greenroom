import { logger } from "./logger.server.js";
import { trackEvent } from "./telemetry.server.js";

// Discord embed color — emerald green (0x57F287) matching the app's brand
const EMBED_COLOR = 0x57f287;

interface DiscordField {
	name: string;
	value: string;
	inline?: boolean;
}

interface DiscordEmbed {
	title: string;
	description?: string;
	color?: number;
	url?: string;
	fields?: DiscordField[];
	footer?: { text: string };
}

const DISCORD_WEBHOOK_PREFIXES = [
	"https://discord.com/api/webhooks/",
	"https://discordapp.com/api/webhooks/",
];

/** Validate that a URL is a Discord webhook URL. */
export function isValidWebhookUrl(url: string): boolean {
	return DISCORD_WEBHOOK_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Send a Discord webhook with embeds. Fire-and-forget — never throws.
 * Returns true on success, false on failure.
 */
export async function sendWebhook(
	webhookUrl: string,
	embed: DiscordEmbed,
	meta?: { groupId?: string; type?: string },
): Promise<boolean> {
	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				embeds: [{ color: EMBED_COLOR, ...embed }],
			}),
		});

		if (!response.ok) {
			logger.warn(
				{ status: response.status, groupId: meta?.groupId, type: meta?.type },
				"Discord webhook returned non-OK status",
			);
			return false;
		}

		trackEvent("WebhookSent", {
			groupId: meta?.groupId ?? "unknown",
			type: meta?.type ?? "unknown",
		});
		return true;
	} catch (error) {
		logger.error(
			{ err: error, groupId: meta?.groupId, type: meta?.type },
			"Failed to send Discord webhook",
		);
		return false;
	}
}

// --- Notification-specific helpers ---

export function sendAvailabilityRequestWebhook(
	webhookUrl: string,
	params: {
		groupName: string;
		title: string;
		createdByName: string;
		dateRange: string;
		requestUrl: string;
	},
): void {
	void sendWebhook(
		webhookUrl,
		{
			title: "📋 New Availability Request",
			description: `**${params.title}**`,
			url: params.requestUrl,
			fields: [
				{ name: "Group", value: params.groupName, inline: true },
				{ name: "Date Range", value: params.dateRange, inline: true },
				{ name: "Created By", value: params.createdByName },
			],
			footer: { text: "Submit your availability on My Call Time" },
		},
		{ groupId: params.groupName, type: "availability_request" },
	);
}

export function sendEventCreatedWebhook(
	webhookUrl: string,
	params: {
		groupName: string;
		eventTitle: string;
		eventType: string;
		dateTime: string;
		location?: string;
		eventUrl: string;
	},
): void {
	const typeLabel = params.eventType.charAt(0).toUpperCase() + params.eventType.slice(1);
	const fields: DiscordField[] = [
		{ name: "Group", value: params.groupName, inline: true },
		{ name: "Type", value: typeLabel, inline: true },
		{ name: "When", value: params.dateTime },
	];
	if (params.location) {
		fields.push({ name: "Where", value: params.location });
	}

	void sendWebhook(
		webhookUrl,
		{
			title: `🎭 New ${typeLabel}: ${params.eventTitle}`,
			url: params.eventUrl,
			fields,
			footer: { text: "View details on My Call Time" },
		},
		{ groupId: params.groupName, type: "event_created" },
	);
}

export function sendEventReminderWebhook(
	webhookUrl: string,
	params: {
		groupName: string;
		eventTitle: string;
		dateTime: string;
		location?: string | null;
		eventUrl: string;
	},
): void {
	const fields: DiscordField[] = [
		{ name: "Group", value: params.groupName, inline: true },
		{ name: "When", value: params.dateTime },
	];
	if (params.location) {
		fields.push({ name: "Where", value: params.location });
	}

	void sendWebhook(
		webhookUrl,
		{
			title: `⏰ Reminder: ${params.eventTitle}`,
			description: "This event is coming up in less than 24 hours!",
			url: params.eventUrl,
			fields,
			footer: { text: "View details on My Call Time" },
		},
		{ groupId: params.groupName, type: "event_reminder" },
	);
}

/**
 * Send a test webhook message to verify the URL works.
 * Unlike other helpers, this awaits and returns the result.
 */
export async function sendTestWebhook(webhookUrl: string, groupName: string): Promise<boolean> {
	return sendWebhook(
		webhookUrl,
		{
			title: "✅ Webhook Connected!",
			description: `This Discord channel will now receive notifications for **${groupName}**.`,
			fields: [
				{
					name: "What you'll receive",
					value: "• New availability requests\n• New events\n• Event reminders",
				},
			],
			footer: { text: "My Call Time" },
		},
		{ groupId: groupName, type: "test" },
	);
}

export function sendEventEditedWebhook(
	webhookUrl: string,
	params: {
		groupName: string;
		eventTitle: string;
		eventType: string;
		dateTime: string;
		location?: string | null;
		changes: string[];
		eventUrl: string;
	},
): void {
	const typeLabel = params.eventType.charAt(0).toUpperCase() + params.eventType.slice(1);
	const changesText = params.changes.map((c) => `• ${c}`).join("\n");

	const fields: DiscordField[] = [
		{ name: "Group", value: params.groupName, inline: true },
		{ name: "Type", value: typeLabel, inline: true },
		{ name: "When", value: params.dateTime },
	];
	if (params.location) {
		fields.push({ name: "Where", value: params.location });
	}
	if (changesText) {
		fields.push({ name: "Changes", value: changesText });
	}

	void sendWebhook(
		webhookUrl,
		{
			title: `✏️ Updated ${typeLabel}: ${params.eventTitle}`,
			url: params.eventUrl,
			fields,
			footer: { text: "View details on My Call Time" },
		},
		{ groupId: params.groupName, type: "event_edited" },
	);
}

export function sendAvailabilityRequestEditedWebhook(
	webhookUrl: string,
	params: {
		groupName: string;
		title: string;
		changes: string[];
		requestUrl: string;
	},
): void {
	const changesText = params.changes.map((c) => `• ${c}`).join("\n");

	const fields: DiscordField[] = [{ name: "Group", value: params.groupName, inline: true }];
	if (changesText) {
		fields.push({ name: "Changes", value: changesText });
	}

	void sendWebhook(
		webhookUrl,
		{
			title: `✏️ Updated Availability Request: ${params.title}`,
			url: params.requestUrl,
			fields,
			footer: { text: "View details on My Call Time" },
		},
		{ groupId: params.groupName, type: "availability_request_edited" },
	);
}
