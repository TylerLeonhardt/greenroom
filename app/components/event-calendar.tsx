import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface EventIndicator {
	id: string;
	title: string;
	eventType: "rehearsal" | "show" | "other";
}

interface EventCalendarProps {
	events: Array<{
		id: string;
		title: string;
		eventType: string;
		startTime: string;
	}>;
	onDateClick?: (date: string, events: EventIndicator[]) => void;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
	show: "bg-purple-600",
	rehearsal: "bg-emerald-600",
	other: "bg-slate-600",
};

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function EventCalendar({ events, onDateClick }: EventCalendarProps) {
	const today = new Date();
	const [year, setYear] = useState(today.getFullYear());
	const [month, setMonth] = useState(today.getMonth());

	const todayKey = toDateKey(today);

	const eventsByDate = useMemo(() => {
		const map = new Map<string, EventIndicator[]>();
		for (const e of events) {
			const d = new Date(e.startTime);
			const key = toDateKey(d);
			if (!map.has(key)) map.set(key, []);
			map.get(key)?.push({
				id: e.id,
				title: e.title,
				eventType: e.eventType as "rehearsal" | "show" | "other",
			});
		}
		return map;
	}, [events]);

	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const firstDayOfWeek = new Date(year, month, 1).getDay();

	const cells = useMemo(() => {
		const result: Array<{ key: string; day: number; dateKey: string } | { key: string }> = [];
		for (let i = 0; i < firstDayOfWeek; i++) result.push({ key: `${year}-${month}-empty-${i}` });
		for (let day = 1; day <= daysInMonth; day++) {
			const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			result.push({ key: dateKey, day, dateKey });
		}
		return result;
	}, [year, month, daysInMonth, firstDayOfWeek]);

	const prevMonth = useCallback(() => {
		if (month === 0) {
			setYear(year - 1);
			setMonth(11);
		} else {
			setMonth(month - 1);
		}
	}, [year, month]);

	const nextMonth = useCallback(() => {
		if (month === 11) {
			setYear(year + 1);
			setMonth(0);
		} else {
			setMonth(month + 1);
		}
	}, [year, month]);

	const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});

	return (
		<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
			{/* Header */}
			<div className="mb-4 flex items-center justify-between">
				<button
					type="button"
					onClick={prevMonth}
					className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
				>
					<ChevronLeft className="h-5 w-5" />
				</button>
				<h3 className="text-sm font-semibold text-slate-900">{monthLabel}</h3>
				<button
					type="button"
					onClick={nextMonth}
					className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
				>
					<ChevronRight className="h-5 w-5" />
				</button>
			</div>

			{/* Day headers */}
			<div className="grid grid-cols-7 gap-1">
				{DAY_HEADERS.map((d) => (
					<div key={d} className="py-1 text-center text-xs font-medium text-slate-400">
						{d}
					</div>
				))}

				{/* Day cells */}
				{cells.map((cell) => {
					if (!("day" in cell)) return <div key={cell.key} />;
					const { day, dateKey } = cell;
					const dayEvents = eventsByDate.get(dateKey) ?? [];
					const isToday = dateKey === todayKey;
					const hasEvents = dayEvents.length > 0;

					return (
						<button
							key={dateKey}
							type="button"
							onClick={() => hasEvents && onDateClick?.(dateKey, dayEvents)}
							className={`relative flex h-10 w-full flex-col items-center justify-center rounded-md text-sm transition-all sm:h-12 ${
								isToday
									? "bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200"
									: hasEvents
										? "font-medium text-slate-900 hover:bg-slate-50"
										: "text-slate-500"
							} ${hasEvents ? "cursor-pointer" : "cursor-default"}`}
						>
							{day}
							{hasEvents && (
								<div className="mt-0.5 flex gap-0.5">
									{dayEvents.slice(0, 3).map((e) => (
										<span
											key={e.id}
											className={`h-1.5 w-1.5 rounded-full ${EVENT_TYPE_COLORS[e.eventType] ?? "bg-slate-600"}`}
										/>
									))}
								</div>
							)}
						</button>
					);
				})}
			</div>

			{/* Legend */}
			<div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
				<div className="flex items-center gap-1.5">
					<span className="h-2 w-2 rounded-full bg-purple-600" />
					Show
				</div>
				<div className="flex items-center gap-1.5">
					<span className="h-2 w-2 rounded-full bg-emerald-600" />
					Rehearsal
				</div>
				<div className="flex items-center gap-1.5">
					<span className="h-2 w-2 rounded-full bg-slate-600" />
					Other
				</div>
			</div>
		</div>
	);
}
