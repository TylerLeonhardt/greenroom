import appInsights from "applicationinsights";
import { logger } from "./logger.server.js";

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

	// Mark all client-error responses (4xx) as successful so they don't inflate the
	// requests/failed metric. Bot scanners, auth challenges, and rate-limit responses
	// are client errors, not server failures, and shouldn't trigger error-rate alerts.
	appInsights.defaultClient.addTelemetryProcessor((envelope) => {
		if (envelope.data?.baseData) {
			const code = parseInt(
				(envelope.data.baseData as { responseCode?: string }).responseCode ?? "",
				10,
			);
			if (!isNaN(code) && code < 500) {
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
