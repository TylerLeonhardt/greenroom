import { describe, expect, it } from "vitest";
// Import directly from groups.server — mergeWithDefaults is a pure function
// We can't easily test DB-dependent functions without a full mock, so we test
// the merge logic and preference types here.
import { mergeWithDefaults } from "~/services/groups.server";
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	type NotificationPreferences,
} from "../../src/db/schema.js";

describe("mergeWithDefaults", () => {
	it("returns defaults when stored is null", () => {
		const result = mergeWithDefaults(null);
		expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
	});

	it("returns defaults when stored is undefined", () => {
		const result = mergeWithDefaults(undefined);
		expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
	});

	it("preserves user-set preferences", () => {
		const stored: NotificationPreferences = {
			availabilityRequests: { email: false },
			eventNotifications: { email: true },
			showReminders: { email: false },
		};
		const result = mergeWithDefaults(stored);
		expect(result.availabilityRequests.email).toBe(false);
		expect(result.eventNotifications.email).toBe(true);
		expect(result.showReminders.email).toBe(false);
	});

	it("fills in missing categories with defaults", () => {
		const stored = {
			availabilityRequests: { email: false },
		} as Partial<NotificationPreferences>;
		const result = mergeWithDefaults(stored);
		expect(result.availabilityRequests.email).toBe(false);
		expect(result.eventNotifications.email).toBe(true);
		expect(result.showReminders.email).toBe(true);
	});

	it("is forward-compatible — unknown stored fields do not break", () => {
		const stored = {
			availabilityRequests: { email: true },
			eventNotifications: { email: true },
			showReminders: { email: true },
		} as NotificationPreferences;
		// Simulate a future channel being added to stored data
		(stored.availabilityRequests as Record<string, boolean>).discord = true;
		const result = mergeWithDefaults(stored);
		expect(result.availabilityRequests.email).toBe(true);
		// The extra 'discord' field is preserved via spread
		expect((result.availabilityRequests as Record<string, boolean>).discord).toBe(true);
	});
});

describe("DEFAULT_NOTIFICATION_PREFERENCES", () => {
	it("has all categories enabled by default", () => {
		expect(DEFAULT_NOTIFICATION_PREFERENCES.availabilityRequests.email).toBe(true);
		expect(DEFAULT_NOTIFICATION_PREFERENCES.eventNotifications.email).toBe(true);
		expect(DEFAULT_NOTIFICATION_PREFERENCES.showReminders.email).toBe(true);
	});
});
