import { useFetcher } from "@remix-run/react";
import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const COMMON_TIMEZONES = [
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Anchorage",
	"Pacific/Honolulu",
	"America/Phoenix",
	"America/Toronto",
	"America/Vancouver",
	"America/Mexico_City",
	"America/Sao_Paulo",
	"America/Argentina/Buenos_Aires",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Amsterdam",
	"Europe/Madrid",
	"Europe/Rome",
	"Europe/Moscow",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Singapore",
	"Asia/Shanghai",
	"Asia/Tokyo",
	"Asia/Seoul",
	"Australia/Sydney",
	"Australia/Melbourne",
	"Pacific/Auckland",
	"UTC",
];

export function getTimezoneLabel(tz: string): string {
	try {
		const now = new Date();
		const offsetStr = now.toLocaleString("en-US", { timeZone: tz, timeZoneName: "short" });
		const match = offsetStr.match(/[A-Z]{2,5}$/);
		const abbrev = match ? match[0] : "";
		const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
		return `${city}${abbrev ? ` (${abbrev})` : ""}`;
	} catch {
		return tz;
	}
}

/**
 * Inline timezone indicator with dropdown to change.
 * Saves to user profile via /settings action using useFetcher.
 */
export function InlineTimezoneSelector({ timezone }: { timezone: string | null }) {
	const fetcher = useFetcher();
	const [isEditing, setIsEditing] = useState(false);
	const selectRef = useRef<HTMLSelectElement>(null);
	const currentTz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

	// Focus the select when switching to edit mode
	useEffect(() => {
		if (isEditing && selectRef.current) {
			selectRef.current.focus();
		}
	}, [isEditing]);

	const handleChange = (newTimezone: string) => {
		fetcher.submit(
			{ intent: "update-timezone", timezone: newTimezone },
			{ method: "post", action: "/settings" },
		);
		setIsEditing(false);
	};

	return (
		<div className="flex items-center gap-1.5 text-xs text-slate-500">
			<Globe className="h-3 w-3" />
			{isEditing ? (
				<select
					ref={selectRef}
					defaultValue={currentTz}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={() => setIsEditing(false)}
					className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
				>
					{COMMON_TIMEZONES.map((tz) => (
						<option key={tz} value={tz}>
							{getTimezoneLabel(tz)}
						</option>
					))}
				</select>
			) : (
				<button
					type="button"
					onClick={() => setIsEditing(true)}
					className="rounded px-1 py-0.5 text-slate-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-slate-700"
				>
					{getTimezoneLabel(currentTz)}
				</button>
			)}
			{fetcher.state === "submitting" && <span className="text-emerald-600">saving…</span>}
		</div>
	);
}
