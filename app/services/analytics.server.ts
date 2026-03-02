import { and, count, gte, isNull } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import { availabilityRequests, events, users } from "../../src/db/schema.js";

export interface AnalyticsData {
	totalUsers: number;
	totalAvailabilityRequests: number;
	totalEvents: number;
	newUsers: number;
	newAvailabilityRequests: number;
	newEvents: number;
	windowDays: number;
}

export async function getAnalytics(windowDays: number): Promise<AnalyticsData> {
	const windowStart = new Date();
	windowStart.setDate(windowStart.getDate() - windowDays);

	const [
		[{ totalUsers }],
		[{ totalAvailabilityRequests }],
		[{ totalEvents }],
		[{ newUsers }],
		[{ newAvailabilityRequests }],
		[{ newEvents }],
	] = await Promise.all([
		db.select({ totalUsers: count() }).from(users).where(isNull(users.deletedAt)),

		db.select({ totalAvailabilityRequests: count() }).from(availabilityRequests),

		db.select({ totalEvents: count() }).from(events),

		db
			.select({ newUsers: count() })
			.from(users)
			.where(and(isNull(users.deletedAt), gte(users.createdAt, windowStart))),

		db
			.select({ newAvailabilityRequests: count() })
			.from(availabilityRequests)
			.where(gte(availabilityRequests.createdAt, windowStart)),

		db.select({ newEvents: count() }).from(events).where(gte(events.createdAt, windowStart)),
	]);

	return {
		totalUsers,
		totalAvailabilityRequests,
		totalEvents,
		newUsers,
		newAvailabilityRequests,
		newEvents,
		windowDays,
	};
}
