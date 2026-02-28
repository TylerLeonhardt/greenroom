import { EmailClient } from "@azure/communication-email";
import { logger } from "./logger.server.js";

// --- Core Email Sender ---

let emailClient: EmailClient | null = null;
const senderAddress = "DoNotReply@mycalltime.app";

function getEmailClient(): EmailClient | null {
	if (emailClient) return emailClient;
	const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
	if (!connectionString) return null;
	try {
		emailClient = new EmailClient(connectionString);
	} catch {
		console.warn("Invalid AZURE_COMMUNICATION_CONNECTION_STRING — email disabled");
		return null;
	}
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
			{ recipientCount: recipients.length, subject: options.subject },
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
		logger.info(
			{ recipientCount: recipients.length, subject: options.subject },
			"Email sent successfully",
		);

		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown email error";
		logger.error({ err: error, to: recipients }, "Failed to send email");

		return { success: false, error: message };
	}
}

// --- Email Templates ---

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function emailLayout(content: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background-color:#059669;padding:24px 32px;">
<span style="font-size:20px;font-weight:700;color:#ffffff;">🎭 My Call Time</span>
</td></tr>
<tr><td style="padding:32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #e2e8f0;">
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
You're receiving this because you're a member of a group on My Call Time.<br>
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

export async function sendVerificationEmail(options: {
	email: string;
	name: string;
	verificationUrl: string;
}): Promise<void> {
	logger.info("Sending verification email");

	const html = emailLayout(`
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Verify Your Email</h1>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">
Hi ${escapeHtml(options.name)}, thanks for signing up! Please verify your email address to get started.
</p>
${ctaButton(options.verificationUrl, "Verify Email Address →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
</p>`);

	const text = `Verify your email for My Call Time: ${options.verificationUrl}. This link expires in 24 hours.`;

	const result = await sendEmail({
		to: options.email,
		subject: "Verify your email — My Call Time",
		html,
		text,
	});

	if (result.success) {
		logger.info("Verification email sent successfully");
	} else {
		logger.error({ error: result.error }, "Verification email failed to send");
	}
}

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
${escapeHtml(options.createdByName)} is asking when you're free.
</p>
<table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<tr><td>
<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(options.requestTitle)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateRange)}</p>
</td></tr>
</table>
${ctaButton(options.requestUrl, "Submit Your Availability →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
Hi ${escapeHtml(recipient.name)}, please respond so your group can plan around everyone's schedule.
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
		? `<p style="margin:0 0 4px;font-size:13px;color:#64748b;">📍 ${escapeHtml(options.location)}</p>`
		: "";

	for (const recipient of options.recipients) {
		const html = emailLayout(`
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">New Event Created</h1>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">
You've been assigned to an upcoming event.
</p>
<table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<tr><td>
<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>
${locationLine}
</td></tr>
</table>
${ctaButton(options.eventUrl, "View Event Details →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
Hi ${escapeHtml(recipient.name)}, please confirm your attendance.
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
Hi ${escapeHtml(options.recipient.name)}, you've been assigned to an event.
</p>
<table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<tr><td>
<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>
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

export async function sendEventFromAvailabilityNotification(options: {
	eventTitle: string;
	eventType: string;
	dateTime: string;
	location?: string;
	groupName: string;
	eventUrl: string;
	availableRecipients: Array<{ email: string; name: string }>;
	maybeRecipients: Array<{ email: string; name: string }>;
	noResponseRecipients: Array<{ email: string; name: string }>;
}): Promise<void> {
	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";
	const locationLine = options.location
		? `<p style="margin:0 0 4px;font-size:13px;color:#64748b;">📍 ${escapeHtml(options.location)}</p>`
		: "";

	const eventBlock = `<table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<tr><td>
<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>
${locationLine}
</td></tr>
</table>`;

	// Email people who said "available" — they're confirmed
	for (const recipient of options.availableRecipients) {
		const html = emailLayout(`
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">You're Confirmed! 🎉</h1>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">
Great news, ${escapeHtml(recipient.name)} — the event you said you were available for is happening!
</p>
${eventBlock}
${ctaButton(options.eventUrl, "View Event Details →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
You indicated you were available for this date. See you there!
</p>`);

		const text = `You're confirmed! "${options.eventTitle}" (${options.groupName}) is happening. ${options.dateTime}${options.location ? ` at ${options.location}` : ""}. View: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `${typeEmoji} You're confirmed — "${options.eventTitle}" is happening!`,
			html,
			text,
		});
	}

	// Email people who said "maybe" — ask them to confirm
	for (const recipient of options.maybeRecipients) {
		const html = emailLayout(`
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Can You Make It?</h1>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">
Hi ${escapeHtml(recipient.name)}, you said you might be free — the event is now scheduled!
</p>
${eventBlock}
${ctaButton(options.eventUrl, "Confirm Attendance →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
Please let your group know if you can make it.
</p>`);

		const text = `Can you make it? "${options.eventTitle}" (${options.groupName}) is on ${options.dateTime}${options.location ? ` at ${options.location}` : ""}. Please confirm: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `${typeEmoji} Can you make it? "${options.eventTitle}" is on ${options.dateTime}`,
			html,
			text,
		});
	}

	// Email people who didn't respond — inform them
	for (const recipient of options.noResponseRecipients) {
		const html = emailLayout(`
<h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">New Event Scheduled</h1>
<p style="margin:0 0 20px;font-size:14px;color:#64748b;">
Hi ${escapeHtml(recipient.name)}, a new event has been scheduled for your group.
</p>
${eventBlock}
${ctaButton(options.eventUrl, "View Event Details →")}
<p style="margin:0;font-size:13px;color:#94a3b8;">
Check out the details and let your group know if you can attend.
</p>`);

		const text = `New event scheduled: "${options.eventTitle}" (${options.groupName}). ${options.dateTime}${options.location ? ` at ${options.location}` : ""}. View: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `${typeEmoji} New event — "${options.eventTitle}" on ${options.dateTime}`,
			html,
			text,
		});
	}
}
