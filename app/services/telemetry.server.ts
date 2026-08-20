import appInsights from "applicationinsights";
import { logger } from "./logger.server.js";

// Calendar feed tokens are bearer credentials — anyone with the token can read the user's events.
// Discord webhook URLs contain auth tokens that allow posting to a channel.
// Both must be redacted before telemetry leaves the process.
const CALENDAR_TOKEN_PATTERN = /\/api\/calendar\/[^/]+\.ics/g;
const DISCORD_WEBHOOK_PATTERN =
	/https:\/\/discord(?:app)?\.com\/api\/webhooks\/[^/\s?]+\/[^/\s?]+/g;
const QUERY_PARAMETER_PATTERN = /([?&])([^=&#\s]+)=[^&#\s]*/g;
const AUTH_TOKEN_QUERY_KEYS = new Set(["token"]);
const OAUTH_QUERY_KEYS = new Set(["code", "state"]);
const GOOGLE_OAUTH_URL_PATTERN =
	/(?:\/auth\/google\/callback|https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth)(?:[?\s]|$)/i;

function redactAuthQueryParameters(url: string): string {
	const isGoogleOAuthUrl = GOOGLE_OAUTH_URL_PATTERN.test(url);

	return url.replace(
		QUERY_PARAMETER_PATTERN,
		(parameter, separator: string, encodedKey: string) => {
			let key: string;
			try {
				key = decodeURIComponent(encodedKey.replace(/\+/g, " ")).toLowerCase();
			} catch {
				return parameter;
			}

			if (!AUTH_TOKEN_QUERY_KEYS.has(key) && !(isGoogleOAuthUrl && OAUTH_QUERY_KEYS.has(key))) {
				return parameter;
			}

			return `${separator}${encodedKey}=[REDACTED]`;
		},
	);
}

/**
 * Redact sensitive tokens from a URL string.
 * - Auth tokens: ?token=SECRET or &token=SECRET → token=[REDACTED]
 * - Google OAuth credentials: code and state on authorization/callback URLs
 * - Calendar feed tokens: /api/calendar/TOKEN.ics → /api/calendar/[REDACTED].ics
 * - Discord webhook URLs: .../webhooks/ID/TOKEN → .../webhooks/[REDACTED]/[REDACTED]
 */
export function redactSensitiveUrls(url: string): string {
	return redactAuthQueryParameters(url)
		.replace(CALENDAR_TOKEN_PATTERN, "/api/calendar/[REDACTED].ics")
		.replace(DISCORD_WEBHOOK_PATTERN, "https://discord.com/api/webhooks/[REDACTED]/[REDACTED]");
}

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (connectionString) {
	appInsights
		.setup(connectionString)
		.setAutoCollectRequests(true)
		.setAutoCollectExceptions(true)
		.setAutoCollectDependencies(true)
		.setAutoCollectPerformance(true, true)
		.setSendLiveMetrics(true)
		.start();

	appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] =
		"mycalltime";

	// Redact auth query tokens, calendar feed tokens, and Discord webhook URLs from
	// request URL/name fields and dependency URL/data fields before telemetry is sent.
	appInsights.defaultClient.addTelemetryProcessor((envelope) => {
		if (envelope.data?.baseData) {
			const baseData = envelope.data.baseData as Record<string, unknown>;
			for (const field of ["url", "name", "data"]) {
				if (typeof baseData[field] === "string") {
					baseData[field] = redactSensitiveUrls(baseData[field]);
				}
			}
		}
		return true;
	});

	// Mark all client-error responses (4xx) as successful so they don't inflate the
	// requests/failed metric. Bot scanners, auth challenges, and rate-limit responses
	// are client errors, not server failures, and shouldn't trigger error-rate alerts.
	appInsights.defaultClient.addTelemetryProcessor((envelope) => {
		if (envelope.data?.baseData) {
			const code = parseInt(
				(envelope.data.baseData as { responseCode?: string }).responseCode ?? "",
				10,
			);
			if (!Number.isNaN(code) && code < 500) {
				(envelope.data.baseData as { success?: boolean }).success = true;
			}
		}
		return true;
	});

	logger.info("Application Insights initialized");
}

/**
 * Returns the App Insights default client if configured, or null.
 * Callers should null-check before tracking custom events.
 */
export function getTelemetryClient(): appInsights.TelemetryClient | null {
	return connectionString ? appInsights.defaultClient : null;
}

/**
 * Track a custom event in Application Insights.
 * Safe no-op when App Insights isn't configured (e.g., local dev).
 */
export function trackEvent(name: string, properties?: Record<string, string>): void {
	getTelemetryClient()?.trackEvent({ name, properties });
}
