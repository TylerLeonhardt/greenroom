import { EmailClient } from "@azure/communication-email";
import { logger } from "./logger.server.js";

// --- Core Email Sender ---

let emailClient: EmailClient | null = null;
const senderAddress = "DoNotReply@greenroom.app";

function getEmailClient(): EmailClient | null {
	if (emailClient) return emailClient;
	const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
	if (!connectionString) return null;
	emailClient = new EmailClient(connectionString);
	return emailClient;
}

export async function sendEmail(options: {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
}): Promise<{ success: boolean; error?: string }> {
	const client = getEmailClient();
	const recipients = Array.isArray(options.to) ? options.to : [options.to];

	if (!client) {
		logger.info(
			{ to: recipients, subject: options.subject },
			"Azure Communication Services not configured — email not sent",
		);
		return { success: true };
	}

	try {
		const poller = await client.beginSend({
			senderAddress,
			content: {
				subject: options.subject,
				html: options.html,
				plainText: options.text,
			},
			recipients: {
				to: recipients.map((email) => ({ address: email })),
			},
		});
		await poller.pollUntilDone();
		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown email error";
		logger.error({ err: error, to: recipients }, "Failed to send email");
		return { success: false, error: message };
	}
}

// --- Email Templates ---

function emailLayout(content: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background-color:#059669;padding:24px 32px;">
<span style="font-size:20px;font-weight:700;color:#ffffff;">🎭 GreenRoom</span>
</td></tr>
<tr><td style="padding:32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #e2e8f0;">
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
You're receiving this because you're a member of a GreenRoom group.<br>
To manage notifications, visit your account settings.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(url: string, label: string): string {
	return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background-color:#059669;border-radius:8px;padding:12px 24px;">
<a href="${url}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">${label}</a>
</td></tr>
</table>`;
}

// --- Notification Senders ---

export async function sendAvailabilityRequestNotification(options: {
	requestId: string;
	requestTitle: string;
	groupName: string;
	dateRange: string;
	createdByName: string;
	recipients: Array<{ email: string; name: string }>;
	requestUrl: string;
}): Promise<void> {
	for (const recipient of options.recipients) {
		const html = emailLayout(`
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">New Availability Request</h1>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">
${options.createdByName} is asking when you're free.
</p>
<table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<tr><td>
<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${options.requestTitle}</p>
<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${options.groupName} · ${options.dateRange}</p>
</td></tr>
</table>
${ctaButton(options.requestUrl, "Submit Your Availability →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
Hi ${recipient.name}, please respond so your group can plan around everyone's schedule.
</p>`);

		const text = `New availability request: "${options.requestTitle}" from ${options.createdByName} (${options.groupName}). Date range: ${options.dateRange}. Respond at: ${options.requestUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `📋 "${options.requestTitle}" — submit your availability`,
			html,
			text,
		});
	}
}

export async function sendEventCreatedNotification(options: {
	eventTitle: string;
	eventType: string;
	dateTime: string;
	location?: string;
	groupName: string;
	recipients: Array<{ email: string; name: string }>;
	eventUrl: string;
}): Promise<void> {
	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";
	const locationLine = options.location
		? `<p style="margin:0 0 4px;font-size:13px;color:#64748b;">📍 ${options.location}</p>`
		: "";

	for (const recipient of options.recipients) {
		const html = emailLayout(`
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">New Event Created</h1>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">
You've been assigned to an upcoming event.
</p>
<table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<tr><td>
<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${options.eventTitle}</p>
<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${options.groupName} · ${options.dateTime}</p>
${locationLine}
</td></tr>
</table>
${ctaButton(options.eventUrl, "View Event Details →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
Hi ${recipient.name}, please confirm your attendance.
</p>`);

		const text = `New event: "${options.eventTitle}" (${options.groupName}). ${options.dateTime}${options.location ? ` at ${options.location}` : ""}. View: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `${typeEmoji} "${options.eventTitle}" — you're assigned`,
			html,
			text,
		});
	}
}

export async function sendEventAssignmentNotification(options: {
	eventTitle: string;
	eventType: string;
	dateTime: string;
	groupName: string;
	recipient: { email: string; name: string };
	eventUrl: string;
}): Promise<void> {
	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";

	const html = emailLayout(`
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">You've Been Added to a ${options.eventType === "show" ? "Show" : options.eventType === "rehearsal" ? "Rehearsal" : "Event"}</h1>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">
Hi ${options.recipient.name}, you've been assigned to an event.
</p>
<table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<tr><td>
<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${options.eventTitle}</p>
<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${options.groupName} · ${options.dateTime}</p>
</td></tr>
</table>
${ctaButton(options.eventUrl, "Confirm Attendance →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
Please confirm or decline so your group knows who's coming.
</p>`);

	const text = `You've been added to "${options.eventTitle}" (${options.groupName}). ${options.dateTime}. Respond at: ${options.eventUrl}`;

	void sendEmail({
		to: options.recipient.email,
		subject: `${typeEmoji} You've been added to "${options.eventTitle}"`,
		html,
		text,
	});
}
