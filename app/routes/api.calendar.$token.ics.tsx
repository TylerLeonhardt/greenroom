import type { LoaderFunctionArgs } from "@remix-run/node";
import { generateCalendarFeed } from "~/lib/ical-utils";
import { getUserByCalendarToken } from "~/services/calendar-token.server";
import { getUserCalendarEvents } from "~/services/events.server";

export async function loader({ params }: LoaderFunctionArgs) {
	const token = params.token;
	if (!token) {
		throw new Response("Not Found", { status: 404 });
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

	return new Response(icsContent, {
		status: 200,
		headers: {
			"Content-Type": "text/calendar; charset=utf-8",
			"Cache-Control": "private, no-store",
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
}
