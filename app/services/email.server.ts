import { EmailClient } from "@azure/communication-email";
import type { NotificationPreferences } from "../../src/db/schema.js";
import { formatEventTime } from "../lib/date-utils.js";
import { logger } from "./logger.server.js";
import { mergeWithDefaults } from "./notification-utils.server.js";
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

function emailLayout(content: string, options?: { preferencesUrl?: string }): string {
	const preferencesLink = options?.preferencesUrl
		? `<p style="color:#94a3b8;font-size:11px;margin:4px 0 0;"><a href="${options.preferencesUrl}" style="color:#94a3b8;text-decoration:underline;">Manage notification preferences</a></p>`
		: "";
	return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1e293b;line-height:1.6;">
<div style="border-bottom:3px solid #059669;padding-bottom:16px;margin-bottom:24px;">
<span style="font-size:20px;font-weight:700;color:#059669;">My Call Time</span>
</div>
${content}
<div style="border-top:1px solid #e2e8f0;margin-top:32px;padding-top:16px;">
<p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">My Call Time - Scheduling for improv groups</p>
<p style="color:#94a3b8;font-size:11px;margin:0;">This is an automated message. Please do not reply directly to this email.</p>
${preferencesLink}
</div>
</div>`;
}

function ctaButton(url: string, label: string): string {
	return `<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a></p>`;
}

function infoCard(lines: string[]): string {
	return `<div style="background:#f0fdf4;border-left:4px solid #059669;border-radius:4px;padding:16px;margin:20px 0;">
${lines.join("\n")}
</div>`;
}

// --- Notification Senders ---

export async function sendVerificationEmail(options: {
	email: string;
	name: string;
	verificationUrl: string;
}): Promise<void> {
	const html = emailLayout(`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Verify Your Email</h2>
<p style="color:#475569;margin:0 0 20px;">Hi ${escapeHtml(options.name)}, thanks for signing up! Please verify your email address to get started.</p>
${ctaButton(options.verificationUrl, "Verify Email Address")}
<p style="color:#64748b;font-size:13px;margin:0;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>`);
	const text = `Hi ${options.name},\n\nThanks for signing up for My Call Time! Please verify your email address:\n\n${options.verificationUrl}\n\nThis link expires in 24 hours. If you didn't create an account, you can safely ignore this email.`;
	const subject = "Verify your email - My Call Time";

	logger.info(
		{
			to: options.email,
			subject,
			htmlLength: html.length,
			htmlPreview: html.substring(0, 200),
			verificationUrl: options.verificationUrl,
		},
		"About to send verification email",
	);

	const result = await sendEmail({
		to: options.email,
		subject,
		html,
		text,
	});

	logger.info(
		{ to: options.email, success: result.success, error: result.error },
		"Verification email result",
	);
}

export async function sendAvailabilityRequestNotification(options: {
	requestId: string;
	requestTitle: string;
	groupName: string;
	dateRange: string;
	createdByName: string;
	recipients: Array<{
		email: string;
		name: string;
		notificationPreferences?: NotificationPreferences;
	}>;
	requestUrl: string;
	preferencesUrl?: string;
}): Promise<void> {
	for (const recipient of options.recipients) {
		const prefs = mergeWithDefaults(recipient.notificationPreferences);
		if (!prefs.availabilityRequests.email) continue;

		const html = emailLayout(
			`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">New Availability Request</h2>
<p style="color:#475569;margin:0 0 20px;">Hi ${escapeHtml(recipient.name)}, ${escapeHtml(options.createdByName)} is asking when you're free.</p>
${infoCard([
	`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(options.requestTitle)}</p>`,
	`<p style="margin:0;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateRange)}</p>`,
])}
${ctaButton(options.requestUrl, "Submit Your Availability")}
<p style="color:#64748b;font-size:13px;margin:0;">Please respond so your group can plan around everyone's schedule.</p>`,
			{ preferencesUrl: options.preferencesUrl },
		);

		const text = `Hi ${recipient.name},\n\n${options.createdByName} is asking when you're free.\n\nRequest: ${options.requestTitle}\nGroup: ${options.groupName}\nDates: ${options.dateRange}\n\nSubmit your availability: ${options.requestUrl}`;

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
	startTime: string | Date;
	endTime: string | Date;
	location?: string;
	groupName: string;
	recipients: Array<{
		email: string;
		name: string;
		timezone?: string | null;
		notificationPreferences?: NotificationPreferences;
	}>;
	eventUrl: string;
	preferencesUrl?: string;
}): Promise<void> {
	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";
	const locationLine = options.location
		? `<p style="margin:0;font-size:13px;color:#475569;">📍 ${escapeHtml(options.location)}</p>`
		: "";

	for (const recipient of options.recipients) {
		const prefs = mergeWithDefaults(recipient.notificationPreferences);
		if (!prefs.eventNotifications.email) continue;

		const dateTime = formatEventTime(
			options.startTime,
			options.endTime,
			recipient.timezone ?? undefined,
		);

		const html = emailLayout(
			`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">New Event Created</h2>
<p style="color:#475569;margin:0 0 20px;">Hi ${escapeHtml(recipient.name)}, you've been assigned to an upcoming event.</p>
${infoCard([
	`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
	`<p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(dateTime)}</p>`,
	locationLine,
])}
${ctaButton(options.eventUrl, "View Event Details")}
<p style="color:#64748b;font-size:13px;margin:0;">Please confirm your attendance so your group knows who's coming.</p>`,
			{ preferencesUrl: options.preferencesUrl },
		);

		const text = `Hi ${recipient.name},\n\nYou've been assigned to an upcoming event.\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${dateTime}${options.location ? `\nWhere: ${options.location}` : ""}\n\nView details and confirm: ${options.eventUrl}`;

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
	recipient: { email: string; name: string; notificationPreferences?: NotificationPreferences };
	eventUrl: string;
	preferencesUrl?: string;
}): Promise<void> {
	const prefs = mergeWithDefaults(options.recipient.notificationPreferences);
	if (!prefs.eventNotifications.email) return;

	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";

	const html = emailLayout(
		`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">You've Been Added to a ${options.eventType === "show" ? "Show" : options.eventType === "rehearsal" ? "Rehearsal" : "Event"}</h2>
<p style="color:#475569;margin:0 0 20px;">Hi ${escapeHtml(options.recipient.name)}, you've been assigned to an event.</p>
${infoCard([
	`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
	`<p style="margin:0;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>`,
])}
${ctaButton(options.eventUrl, "Confirm Attendance")}
<p style="color:#64748b;font-size:13px;margin:0;">Please confirm or decline so your group knows who's coming.</p>`,
		{ preferencesUrl: options.preferencesUrl },
	);

	const text = `Hi ${options.recipient.name},\n\nYou've been added to an event.\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${options.dateTime}\n\nConfirm your attendance: ${options.eventUrl}`;

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
	startTime: string | Date;
	endTime: string | Date;
	location?: string;
	groupName: string;
	eventUrl: string;
	availableRecipients: Array<{
		email: string;
		name: string;
		timezone?: string | null;
		notificationPreferences?: NotificationPreferences;
	}>;
	maybeRecipients: Array<{
		email: string;
		name: string;
		timezone?: string | null;
		notificationPreferences?: NotificationPreferences;
	}>;
	noResponseRecipients: Array<{
		email: string;
		name: string;
		timezone?: string | null;
		notificationPreferences?: NotificationPreferences;
	}>;
	preferencesUrl?: string;
}): Promise<void> {
	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";
	const locationLine = options.location
		? `<p style="margin:0;font-size:13px;color:#475569;">📍 ${escapeHtml(options.location)}</p>`
		: "";

	const layoutOpts = { preferencesUrl: options.preferencesUrl };

	// Email people who said "available" — they're confirmed
	for (const recipient of options.availableRecipients) {
		const prefs = mergeWithDefaults(recipient.notificationPreferences);
		if (!prefs.eventNotifications.email) continue;
		const dateTime = formatEventTime(
			options.startTime,
			options.endTime,
			recipient.timezone ?? undefined,
		);
		const eventBlock = infoCard([
			`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
			`<p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(dateTime)}</p>`,
			locationLine,
		]);

		const html = emailLayout(
			`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">You're Confirmed!</h2>
<p style="color:#475569;margin:0 0 20px;">Great news, ${escapeHtml(recipient.name)} - the event you said you were available for is happening!</p>
${eventBlock}
${ctaButton(options.eventUrl, "View Event Details")}
<p style="color:#64748b;font-size:13px;margin:0;">You indicated you were available for this date. See you there!</p>`,
			layoutOpts,
		);

		const text = `Hi ${recipient.name},\n\nGreat news - you're confirmed! The event you said you were available for is happening.\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${dateTime}${options.location ? `\nWhere: ${options.location}` : ""}\n\nView details: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `${typeEmoji} You're confirmed — "${options.eventTitle}" is happening!`,
			html,
			text,
		});
	}

	// Email people who said "maybe" — ask them to confirm
	for (const recipient of options.maybeRecipients) {
		const prefs = mergeWithDefaults(recipient.notificationPreferences);
		if (!prefs.eventNotifications.email) continue;
		const dateTime = formatEventTime(
			options.startTime,
			options.endTime,
			recipient.timezone ?? undefined,
		);
		const eventBlock = infoCard([
			`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
			`<p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(dateTime)}</p>`,
			locationLine,
		]);

		const html = emailLayout(
			`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Can You Make It?</h2>
<p style="color:#475569;margin:0 0 20px;">Hi ${escapeHtml(recipient.name)}, you said you might be free - the event is now scheduled!</p>
${eventBlock}
${ctaButton(options.eventUrl, "Confirm Attendance")}
<p style="color:#64748b;font-size:13px;margin:0;">Please let your group know if you can make it.</p>`,
			layoutOpts,
		);

		const text = `Hi ${recipient.name},\n\nYou said you might be free - the event is now scheduled!\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${dateTime}${options.location ? `\nWhere: ${options.location}` : ""}\n\nConfirm your attendance: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `${typeEmoji} Can you make it? "${options.eventTitle}" is on ${dateTime}`,
			html,
			text,
		});
	}

	// Email people who didn't respond — inform them
	for (const recipient of options.noResponseRecipients) {
		const prefs = mergeWithDefaults(recipient.notificationPreferences);
		if (!prefs.eventNotifications.email) continue;
		const dateTime = formatEventTime(
			options.startTime,
			options.endTime,
			recipient.timezone ?? undefined,
		);
		const eventBlock = infoCard([
			`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
			`<p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(dateTime)}</p>`,
			locationLine,
		]);

		const html = emailLayout(
			`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">New Event Scheduled</h2>
<p style="color:#475569;margin:0 0 20px;">Hi ${escapeHtml(recipient.name)}, a new event has been scheduled for your group.</p>
${eventBlock}
${ctaButton(options.eventUrl, "View Event Details")}
<p style="color:#64748b;font-size:13px;margin:0;">Check out the details and let your group know if you can attend.</p>`,
			layoutOpts,
		);

		const text = `Hi ${recipient.name},\n\nA new event has been scheduled for your group.\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${dateTime}${options.location ? `\nWhere: ${options.location}` : ""}\n\nView details: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `${typeEmoji} New event — "${options.eventTitle}" on ${dateTime}`,
			html,
			text,
		});
	}
}

export async function sendEventReminderNotification(options: {
	eventTitle: string;
	eventType: string;
	dateTime: string;
	location?: string | null;
	callTime?: string | null;
	groupName: string;
	recipient: { email: string; name: string; notificationPreferences?: NotificationPreferences };
	eventUrl: string;
	preferencesUrl?: string;
}): Promise<void> {
	const prefs = mergeWithDefaults(options.recipient.notificationPreferences);
	if (!prefs.showReminders.email) return;

	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";
	const locationLine = options.location
		? `<p style="margin:0;font-size:13px;color:#475569;">📍 ${escapeHtml(options.location)}</p>`
		: "";
	const callTimeLine = options.callTime
		? `<p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#b45309;">🕐 Call time: ${escapeHtml(options.callTime)}</p>`
		: "";

	const html = emailLayout(
		`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Event Reminder</h2>
<p style="color:#475569;margin:0 0 20px;">Hi ${escapeHtml(options.recipient.name)}, just a reminder — you have an event coming up tomorrow!</p>
${infoCard([
	`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
	`<p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>`,
	locationLine,
	callTimeLine,
])}
${ctaButton(options.eventUrl, "View Event Details")}
<p style="color:#64748b;font-size:13px;margin:0;">See you there!</p>`,
		{ preferencesUrl: options.preferencesUrl },
	);

	const text = `Hi ${options.recipient.name},\n\nReminder: you have an event coming up tomorrow!\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${options.dateTime}${options.location ? `\nWhere: ${options.location}` : ""}${options.callTime ? `\nCall time: ${options.callTime}` : ""}\n\nView details: ${options.eventUrl}`;

	void sendEmail({
		to: options.recipient.email,
		subject: `⏰ Reminder: "${options.eventTitle}" is tomorrow`,
		html,
		text,
	});
}

export async function sendConfirmationReminderNotification(options: {
	eventTitle: string;
	eventType: string;
	dateTime: string;
	location?: string | null;
	groupName: string;
	recipient: { email: string; name: string; notificationPreferences?: NotificationPreferences };
	eventUrl: string;
	preferencesUrl?: string;
}): Promise<void> {
	const prefs = mergeWithDefaults(options.recipient.notificationPreferences);
	if (!prefs.showReminders.email) return;

	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";
	const locationLine = options.location
		? `<p style="margin:0;font-size:13px;color:#475569;">📍 ${escapeHtml(options.location)}</p>`
		: "";

	const html = emailLayout(
		`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Please Confirm Your Attendance</h2>
<p style="color:#475569;margin:0 0 20px;">Hi ${escapeHtml(options.recipient.name)}, you haven't confirmed yet — this event is in 2 days!</p>
${infoCard([
	`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
	`<p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(options.dateTime)}</p>`,
	locationLine,
])}
${ctaButton(options.eventUrl, "Confirm Attendance")}
<p style="color:#64748b;font-size:13px;margin:0;">Please confirm or decline so your group knows who's coming.</p>`,
		{ preferencesUrl: options.preferencesUrl },
	);

	const text = `Hi ${options.recipient.name},\n\nYou haven't confirmed yet — this event is in 2 days!\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${options.dateTime}${options.location ? `\nWhere: ${options.location}` : ""}\n\nConfirm your attendance: ${options.eventUrl}`;

	void sendEmail({
		to: options.recipient.email,
		subject: `⏰ Please confirm: "${options.eventTitle}" in 2 days`,
		html,
		text,
	});
}

// --- Edit Notification Senders ---

function changesList(changes: string[]): string {
	if (changes.length === 0) return "";
	const items = changes
		.map((c) => `<li style="margin:4px 0;color:#475569;">${escapeHtml(c)}</li>`)
		.join("\n");
	return `<ul style="padding-left:20px;margin:12px 0;">\n${items}\n</ul>`;
}

function changesText(changes: string[]): string {
	return changes.map((c) => `• ${c}`).join("\n");
}

export async function sendEventEditedNotification(options: {
	eventTitle: string;
	eventType: string;
	startTime: string | Date;
	endTime: string | Date;
	location?: string | null;
	groupName: string;
	changes: string[];
	recipients: Array<{
		email: string;
		name: string;
		timezone?: string | null;
		notificationPreferences?: NotificationPreferences;
	}>;
	eventUrl: string;
	preferencesUrl?: string;
}): Promise<void> {
	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";
	const changesHtml = changesList(options.changes);
	const changesPlain = changesText(options.changes);

	for (const recipient of options.recipients) {
		const prefs = mergeWithDefaults(recipient.notificationPreferences);
		if (!prefs.eventNotifications.email) continue;

		const dateTime = formatEventTime(
			options.startTime,
			options.endTime,
			recipient.timezone ?? undefined,
		);

		const html = emailLayout(
			`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Event Updated</h2>
<p style="color:#475569;margin:0 0 12px;">Hi ${escapeHtml(recipient.name)}, an event in your group has been updated.</p>
${infoCard([
	`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
	`<p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(dateTime)}</p>`,
	options.location
		? `<p style="margin:0;font-size:13px;color:#475569;">📍 ${escapeHtml(options.location)}</p>`
		: "",
])}
<p style="color:#475569;font-weight:600;margin:16px 0 4px;">What changed:</p>
${changesHtml}
${ctaButton(options.eventUrl, "View Updated Event")}`,
			{ preferencesUrl: options.preferencesUrl },
		);

		const text = `Hi ${recipient.name},\n\nAn event in your group has been updated.\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${dateTime}${options.location ? `\nWhere: ${options.location}` : ""}\n\nWhat changed:\n${changesPlain}\n\nView details: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `✏️ "${options.eventTitle}" updated — ${options.groupName}`,
			html,
			text,
		});
	}
}

export async function sendEventReconfirmationNotification(options: {
	eventTitle: string;
	eventType: string;
	startTime: string | Date;
	endTime: string | Date;
	location?: string | null;
	groupName: string;
	changes: string[];
	recipients: Array<{
		email: string;
		name: string;
		timezone?: string | null;
		notificationPreferences?: NotificationPreferences;
	}>;
	eventUrl: string;
	preferencesUrl?: string;
}): Promise<void> {
	const typeEmoji =
		options.eventType === "show" ? "🎭" : options.eventType === "rehearsal" ? "🎯" : "📅";
	const changesHtml = changesList(options.changes);
	const changesPlain = changesText(options.changes);

	for (const recipient of options.recipients) {
		const prefs = mergeWithDefaults(recipient.notificationPreferences);
		if (!prefs.eventNotifications.email) continue;

		const dateTime = formatEventTime(
			options.startTime,
			options.endTime,
			recipient.timezone ?? undefined,
		);

		const html = emailLayout(
			`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Please Re-confirm Your Attendance</h2>
<p style="color:#475569;margin:0 0 12px;">Hi ${escapeHtml(recipient.name)}, an event has been updated and your confirmation has been reset.</p>
${infoCard([
	`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">${typeEmoji} ${escapeHtml(options.eventTitle)}</p>`,
	`<p style="margin:0 0 4px;font-size:13px;color:#475569;">${escapeHtml(options.groupName)} · ${escapeHtml(dateTime)}</p>`,
	options.location
		? `<p style="margin:0;font-size:13px;color:#475569;">📍 ${escapeHtml(options.location)}</p>`
		: "",
])}
<p style="color:#475569;font-weight:600;margin:16px 0 4px;">What changed:</p>
${changesHtml}
${ctaButton(options.eventUrl, "Confirm Attendance")}
<p style="color:#64748b;font-size:13px;margin:0;">Please confirm or decline so your group knows who's coming.</p>`,
			{ preferencesUrl: options.preferencesUrl },
		);

		const text = `Hi ${recipient.name},\n\nAn event has been updated and your confirmation has been reset. Please re-confirm.\n\nEvent: ${options.eventTitle}\nGroup: ${options.groupName}\nWhen: ${dateTime}${options.location ? `\nWhere: ${options.location}` : ""}\n\nWhat changed:\n${changesPlain}\n\nConfirm your attendance: ${options.eventUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `🔄 "${options.eventTitle}" updated — please re-confirm`,
			html,
			text,
		});
	}
}

export async function sendAvailabilityRequestEditedNotification(options: {
	requestTitle: string;
	groupName: string;
	changes: string[];
	recipients: Array<{
		email: string;
		name: string;
		notificationPreferences?: NotificationPreferences;
	}>;
	requestUrl: string;
	preferencesUrl?: string;
}): Promise<void> {
	const changesHtml = changesList(options.changes);
	const changesPlain = changesText(options.changes);

	for (const recipient of options.recipients) {
		const prefs = mergeWithDefaults(recipient.notificationPreferences);
		if (!prefs.availabilityRequests.email) continue;

		const html = emailLayout(
			`
<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Availability Request Updated</h2>
<p style="color:#475569;margin:0 0 12px;">Hi ${escapeHtml(recipient.name)}, an availability request has been updated.</p>
${infoCard([
	`<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">📋 ${escapeHtml(options.requestTitle)}</p>`,
	`<p style="margin:0;font-size:13px;color:#475569;">${escapeHtml(options.groupName)}</p>`,
])}
<p style="color:#475569;font-weight:600;margin:16px 0 4px;">What changed:</p>
${changesHtml}
${ctaButton(options.requestUrl, "View Updated Request")}
<p style="color:#64748b;font-size:13px;margin:0;">You may want to review and update your response.</p>`,
			{ preferencesUrl: options.preferencesUrl },
		);

		const text = `Hi ${recipient.name},\n\nAn availability request has been updated.\n\nRequest: ${options.requestTitle}\nGroup: ${options.groupName}\n\nWhat changed:\n${changesPlain}\n\nView updated request: ${options.requestUrl}`;

		void sendEmail({
			to: recipient.email,
			subject: `✏️ "${options.requestTitle}" updated — ${options.groupName}`,
			html,
			text,
		});
	}
}
