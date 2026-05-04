import { createHash } from "node:crypto";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { generateCalendarFeed } from "~/lib/ical-utils";
import { getUserByCalendarToken } from "~/services/calendar-token.server";
import { getUserCalendarEvents } from "~/services/events.server";
import { checkCalendarFeedRateLimit } from "~/services/rate-limit.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
	const rawToken = params.token;
	if (!rawToken) {
		throw new Response("Not Found", { status: 404 });
	}

	// The URL is /api/calendar/TOKEN.ics but Remix flat routing captures the
	// full path segment (including ".ics") in the $token param. Strip the
	// extension so we can look up the bare hex token.
	if (!rawToken.endsWith(".ics")) {
		throw new Response("Not Found", { status: 404 });
	}
	const token = rawToken.slice(0, -4);
	if (!token || !/^[a-f0-9]+$/.test(token)) {
		throw new Response("Not Found", { status: 404 });
	}

	// Rate limit by token — 30 requests per hour
	const rateLimit = checkCalendarFeedRateLimit(token);
	if (rateLimit.limited) {
		return new Response("Too Many Requests", {
			status: 429,
			headers: { "Retry-After": String(rateLimit.retryAfter) },
		});
	}

	const user = await getUserByCalendarToken(token);
	if (!user) {
		throw new Response("Not Found", { status: 404 });
	}

	const events = await getUserCalendarEvents(user.id);

	const calendarEvents = events.map((event) => ({
		id: event.id,
		title: event.title,
		description: event.description,
		location: event.location,
		startTime: new Date(event.startTime as unknown as string),
		endTime: new Date(event.endTime as unknown as string),
		callTime: event.callTime ? new Date(event.callTime as unknown as string) : null,
		eventType: event.eventType,
		groupName: event.groupName,
		userRole: event.userRole,
		updatedAt: new Date(event.updatedAt as unknown as string),
	}));

	const icsContent = generateCalendarFeed(calendarEvents);

	// ETag for conditional request support
	const etag = `"${createHash("sha256").update(icsContent).digest("hex")}"`;
	const ifNoneMatch = request.headers.get("If-None-Match");
	if (ifNoneMatch === etag) {
		return new Response(null, {
			status: 304,
			headers: {
				ETag: etag,
				"Cache-Control": "public, max-age=300",
			},
		});
	}

	return new Response(icsContent, {
		status: 200,
		headers: {
			"Content-Type": "text/calendar; charset=utf-8",
			"Cache-Control": "public, max-age=300",
			ETag: etag,
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
}
