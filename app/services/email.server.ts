import { EmailClient } from "@azure/communication-email";
import { logger } from "./logger.server.js";
import { getTelemetryClient } from "./telemetry.server.js";

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

		getTelemetryClient()?.trackEvent({
			name: "EmailSent",
			properties: {
				success: "true",
				recipientCount: String(recipients.length),
				subject: options.subject,
			},
		});

		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown email error";
		logger.error({ err: error, to: recipients }, "Failed to send email");

		const telemetry = getTelemetryClient();
		if (telemetry) {
			telemetry.trackEvent({
				name: "EmailSent",
				properties: {
					success: "false",
					recipientCount: String(recipients.length),
					subject: options.subject,
				},
			});
			telemetry.trackException({
				exception: error instanceof Error ? error : new Error(message),
				properties: {
					emailSubject: options.subject,
					recipientCount: String(recipients.length),
				},
			});
		}

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
	return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;">
${content}
<p style="color:#999;font-size:12px;">— My Call Time</p>
</div>`;
}

function ctaButton(url: string, label: string): string {
	return `<p><a href="${url}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${label}</a></p>`;
}

// --- Notification Senders ---

export async function sendVerificationEmail(options: {
	email: string;
	name: string;
	verificationUrl: string;
}): Promise<void> {
	logger.info("Sending verification email");

	const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;">
<h2>Verify Your Email</h2>
<p>Hi ${escapeHtml(options.name)}, thanks for signing up for My Call Time!</p>
<p>Please verify your email address by clicking the link below:</p>
<p><a href="${options.verificationUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Verify Email Address</a></p>
<p style="color:#666;font-size:13px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
<p style="color:#999;font-size:12px;">— My Call Time</p>
</div>`;

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
<h2>New Availability Request</h2>
<p style="color:#666;">${escapeHtml(options.createdByName)} is asking when you're free.</p>
<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<p style="margin:0 0 4px;font-size:16px;font-weight:600;">${escapeHtml(options.requestTitle)}</p>
<p style="margin:0;font-size:13px;color:#666;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateRange)}</p>
</div>
${ctaButton(options.requestUrl, "Submit Your Availability →")}
<p style="color:#666;font-size:13px;">
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
		? `<p style="margin:0;font-size:13px;color:#666;">📍 ${escapeHtml(options.location)}</p>`
		: "";

	for (const recipient of options.recipients) {
		const html = emailLayout(`
<h2>New Event Created</h2>
<p style="color:#666;">You've been assigned to an upcoming event.</p>
<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<p style="margin:0 0 4px;font-size:16px;font-weight:600;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#666;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>
${locationLine}
</div>
${ctaButton(options.eventUrl, "View Event Details →")}
<p style="color:#666;font-size:13px;">
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
<h2>You've Been Added to a ${options.eventType === "show" ? "Show" : options.eventType === "rehearsal" ? "Rehearsal" : "Event"}</h2>
<p style="color:#666;">Hi ${escapeHtml(options.recipient.name)}, you've been assigned to an event.</p>
<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<p style="margin:0 0 4px;font-size:16px;font-weight:600;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>
<p style="margin:0;font-size:13px;color:#666;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>
</div>
${ctaButton(options.eventUrl, "Confirm Attendance →")}
<p style="color:#666;font-size:13px;">
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
		? `<p style="margin:0;font-size:13px;color:#666;">📍 ${escapeHtml(options.location)}</p>`
		: "";

	const eventBlock = `<div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:8px;">
<p style="margin:0 0 4px;font-size:16px;font-weight:600;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>
<p style="margin:0 0 4px;font-size:13px;color:#666;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>
${locationLine}
</div>`;

	// Email people who said "available" — they're confirmed
	for (const recipient of options.availableRecipients) {
		const html = emailLayout(`
<h2>You're Confirmed! 🎉</h2>
<p style="color:#666;">Great news, ${escapeHtml(recipient.name)} — the event you said you were available for is happening!</p>
${eventBlock}
${ctaButton(options.eventUrl, "View Event Details →")}
<p style="color:#666;font-size:13px;">
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
<h2>Can You Make It?</h2>
<p style="color:#666;">Hi ${escapeHtml(recipient.name)}, you said you might be free — the event is now scheduled!</p>
${eventBlock}
${ctaButton(options.eventUrl, "Confirm Attendance →")}
<p style="color:#666;font-size:13px;">
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
<h2>New Event Scheduled</h2>
<p style="color:#666;">Hi ${escapeHtml(recipient.name)}, a new event has been scheduled for your group.</p>
${eventBlock}
${ctaButton(options.eventUrl, "View Event Details →")}
<p style="color:#666;font-size:13px;">
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
