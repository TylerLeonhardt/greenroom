import type { NotificationPreferences } from "../../src/db/schema.js";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../../src/db/schema.js";

/**
 * Merge stored preferences with defaults for forward-compatibility.
 * New categories or channels added later will default to true.
 */
export function mergeWithDefaults(
	stored: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
	const defaults = DEFAULT_NOTIFICATION_PREFERENCES;
	if (!stored) return { ...defaults };
	return {
		availabilityRequests: { ...defaults.availabilityRequests, ...stored.availabilityRequests },
		eventNotifications: { ...defaults.eventNotifications, ...stored.eventNotifications },
		showReminders: { ...defaults.showReminders, ...stored.showReminders },
	};
}
