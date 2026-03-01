import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../src/db/index.js";
import {
	availabilityRequests,
	availabilityResponses,
	events,
	groupMemberships,
	users,
} from "../../src/db/schema.js";

type AvailabilityRequest = typeof availabilityRequests.$inferSelect;

// --- Create ---

export async function createAvailabilityRequest(data: {
	groupId: string;
	title: string;
	description?: string;
	dateRangeStart: Date;
	dateRangeEnd: Date;
	requestedDates: string[];
	createdById: string;
	expiresAt?: Date;
	requestedStartTime?: string;
	requestedEndTime?: string;
}): Promise<AvailabilityRequest> {
	const [request] = await db
		.insert(availabilityRequests)
		.values({
			groupId: data.groupId,
			title: data.title.trim(),
			description: data.description?.trim() || null,
			dateRangeStart: data.dateRangeStart,
			dateRangeEnd: data.dateRangeEnd,
			requestedDates: data.requestedDates,
			createdById: data.createdById,
			expiresAt: data.expiresAt ?? null,
			requestedStartTime: data.requestedStartTime ?? null,
			requestedEndTime: data.requestedEndTime ?? null,
		})
		.returning();
	if (!request) throw new Error("Failed to create availability request.");
	return request;
}

// --- List ---

export async function getGroupAvailabilityRequests(groupId: string): Promise<
	Array<
		AvailabilityRequest & {
			responseCount: number;
			memberCount: number;
			createdByName: string;
		}
	>
> {
	const rows = await db
		.select({
			id: availabilityRequests.id,
			groupId: availabilityRequests.groupId,
			title: availabilityRequests.title,
			description: availabilityRequests.description,
			dateRangeStart: availabilityRequests.dateRangeStart,
			dateRangeEnd: availabilityRequests.dateRangeEnd,
			requestedDates: availabilityRequests.requestedDates,
			requestedStartTime: availabilityRequests.requestedStartTime,
			requestedEndTime: availabilityRequests.requestedEndTime,
			status: availabilityRequests.status,
			createdById: availabilityRequests.createdById,
			createdAt: availabilityRequests.createdAt,
			expiresAt: availabilityRequests.expiresAt,
			createdByName: users.name,
			responseCount: sql<number>`cast((
				select count(*) from availability_responses
				where availability_responses.request_id = ${availabilityRequests.id}
			) as int)`,
			memberCount: sql<number>`cast((
				select count(*) from group_memberships
				where group_memberships.group_id = ${availabilityRequests.groupId}
			) as int)`,
		})
		.from(availabilityRequests)
		.innerJoin(users, eq(availabilityRequests.createdById, users.id))
		.where(eq(availabilityRequests.groupId, groupId))
		.orderBy(
			sql`case when ${availabilityRequests.status} = 'open' then 0 else 1 end`,
			desc(availabilityRequests.createdAt),
		);

	return rows;
}

// --- Get Single ---

export async function getAvailabilityRequest(
	requestId: string,
): Promise<(AvailabilityRequest & { createdByName: string }) | null> {
	const [row] = await db
		.select({
			id: availabilityRequests.id,
			groupId: availabilityRequests.groupId,
			title: availabilityRequests.title,
			description: availabilityRequests.description,
			dateRangeStart: availabilityRequests.dateRangeStart,
			dateRangeEnd: availabilityRequests.dateRangeEnd,
			requestedDates: availabilityRequests.requestedDates,
			requestedStartTime: availabilityRequests.requestedStartTime,
			requestedEndTime: availabilityRequests.requestedEndTime,
			status: availabilityRequests.status,
			createdById: availabilityRequests.createdById,
			createdAt: availabilityRequests.createdAt,
			expiresAt: availabilityRequests.expiresAt,
			createdByName: users.name,
		})
		.from(availabilityRequests)
		.innerJoin(users, eq(availabilityRequests.createdById, users.id))
		.where(eq(availabilityRequests.id, requestId))
		.limit(1);
	return row ?? null;
}

// --- Submit / Update Response (upsert) ---

export async function submitAvailabilityResponse(data: {
	requestId: string;
	userId: string;
	responses: Record<string, "available" | "maybe" | "not_available">;
}): Promise<void> {
	const now = new Date();
	await db
		.insert(availabilityResponses)
		.values({
			requestId: data.requestId,
			userId: data.userId,
			responses: data.responses,
			respondedAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [availabilityResponses.requestId, availabilityResponses.userId],
			set: {
				responses: data.responses,
				updatedAt: now,
			},
		});
}

// --- Get User Response ---

export async function getUserResponse(
	requestId: string,
	userId: string,
): Promise<Record<string, string> | null> {
	const [row] = await db
		.select({ responses: availabilityResponses.responses })
		.from(availabilityResponses)
		.where(
			and(eq(availabilityResponses.requestId, requestId), eq(availabilityResponses.userId, userId)),
		)
		.limit(1);
	return (row?.responses as Record<string, string>) ?? null;
}

// --- Get All Responses ---

export async function getRequestResponses(requestId: string): Promise<
	Array<{
		userId: string;
		userName: string;
		responses: Record<string, string>;
		respondedAt: Date;
	}>
> {
	const rows = await db
		.select({
			userId: availabilityResponses.userId,
			userName: users.name,
			responses: availabilityResponses.responses,
			respondedAt: availabilityResponses.respondedAt,
		})
		.from(availabilityResponses)
		.innerJoin(users, eq(availabilityResponses.userId, users.id))
		.where(eq(availabilityResponses.requestId, requestId))
		.orderBy(users.name);
	return rows as Array<{
		userId: string;
		userName: string;
		responses: Record<string, string>;
		respondedAt: Date;
	}>;
}

// --- Aggregated Results ---

export async function getAggregatedResults(requestId: string): Promise<{
	dates: Array<{
		date: string;
		available: number;
		maybe: number;
		notAvailable: number;
		noResponse: number;
		total: number;
		score: number;
		respondents: Array<{ name: string; status: string }>;
	}>;
	totalMembers: number;
	totalResponded: number;
}> {
	const request = await getAvailabilityRequest(requestId);
	if (!request) throw new Error("Request not found.");

	const dates = request.requestedDates as string[];

	// Get member count
	const [memberRow] = await db
		.select({ count: count() })
		.from(groupMemberships)
		.where(eq(groupMemberships.groupId, request.groupId));
	const totalMembers = memberRow?.count ?? 0;

	// Get all responses
	const responses = await getRequestResponses(requestId);
	const totalResponded = responses.length;

	const dateResults = dates.map((date) => {
		let available = 0;
		let maybe = 0;
		let notAvailable = 0;
		const respondents: Array<{ name: string; status: string }> = [];

		for (const resp of responses) {
			const status = resp.responses[date];
			if (status === "available") {
				available++;
				respondents.push({ name: resp.userName, status: "available" });
			} else if (status === "maybe") {
				maybe++;
				respondents.push({ name: resp.userName, status: "maybe" });
			} else if (status === "not_available") {
				notAvailable++;
				respondents.push({ name: resp.userName, status: "not_available" });
			}
		}

		const noResponse = totalMembers - available - maybe - notAvailable;
		const score = available * 2 + maybe;

		return {
			date,
			available,
			maybe,
			notAvailable,
			noResponse,
			total: totalMembers,
			score,
			respondents,
		};
	});

	return { dates: dateResults, totalMembers, totalResponded };
}

// --- Close / Reopen ---

export async function getOpenAvailabilityRequestCount(groupId: string): Promise<number> {
	const [row] = await db
		.select({ count: count() })
		.from(availabilityRequests)
		.where(and(eq(availabilityRequests.groupId, groupId), eq(availabilityRequests.status, "open")));
	return row?.count ?? 0;
}

export async function closeAvailabilityRequest(requestId: string): Promise<void> {
	await db
		.update(availabilityRequests)
		.set({ status: "closed" })
		.where(eq(availabilityRequests.id, requestId));
}

export async function reopenAvailabilityRequest(requestId: string): Promise<void> {
	await db
		.update(availabilityRequests)
		.set({ status: "open" })
		.where(eq(availabilityRequests.id, requestId));
}

// --- Delete ---

export async function deleteAvailabilityRequest(requestId: string): Promise<void> {
	await db.transaction(async (tx) => {
		// Unlink any events that were created from this request
		await tx
			.update(events)
			.set({ createdFromRequestId: null })
			.where(eq(events.createdFromRequestId, requestId));

		// Delete the request (responses cascade automatically)
		await tx.delete(availabilityRequests).where(eq(availabilityRequests.id, requestId));
	});
}
