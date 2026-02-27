import type { LoaderFunctionArgs } from "@remix-run/node";
import { getEventWithAssignments } from "~/services/events.server";
import { requireUser } from "~/services/auth.server";

function formatICalDate(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
}

function escapeICalText(text: string): string {
	return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
	const maxLen = 75;
	if (line.length <= maxLen) return line;
	const parts: string[] = [];
	parts.push(line.slice(0, maxLen));
	let i = maxLen;
	while (i < line.length) {
		parts.push(` ${line.slice(i, i + maxLen - 1)}`);
		i += maxLen - 1;
	}
	return parts.join("\r\n");
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	await requireUser(request);
	const eventId = params.eventId ?? "";

	const data = await getEventWithAssignments(eventId);
	if (!data) {
		throw new Response("Not Found", { status: 404 });
	}

	const { event } = data;
	const url = new URL(request.url);
	const role = url.searchParams.get("role");

	// Performers at shows with call time get earlier start
	const isPerformerAtShow =
		role === "Performer" && event.eventType === "show" && event.callTime;
	const startTime = isPerformerAtShow ? new Date(event.callTime!) : new Date(event.startTime);
	const endTime = new Date(event.endTime);

	const now = new Date();
	const uid = `${event.id}@greenroom.app`;

	const lines: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//GreenRoom//Events//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		foldLine(`UID:${uid}`),
		`DTSTAMP:${formatICalDate(now)}`,
		`DTSTART:${formatICalDate(startTime)}`,
		`DTEND:${formatICalDate(endTime)}`,
		foldLine(`SUMMARY:${escapeICalText(event.title)}`),
	];

	if (event.description) {
		lines.push(foldLine(`DESCRIPTION:${escapeICalText(event.description)}`));
	}
	if (event.location) {
		lines.push(foldLine(`LOCATION:${escapeICalText(event.location)}`));
	}

	lines.push("END:VEVENT", "END:VCALENDAR");

	const icsContent = lines.join("\r\n");
	const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, "-")}.ics`;

	return new Response(icsContent, {
		status: 200,
		headers: {
			"Content-Type": "text/calendar; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
}
