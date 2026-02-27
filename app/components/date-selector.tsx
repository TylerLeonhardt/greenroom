import { useCallback, useMemo } from "react";

interface DateSelectorProps {
	startDate: string;
	endDate: string;
	selectedDates: string[];
	onChange: (dates: string[]) => void;
}

function formatMonthYear(year: number, month: number): string {
	return new Date(year, month, 1).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
}

function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
	return new Date(year, month, 1).getDay();
}

function toDateString(year: number, month: number, day: number): string {
	return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DateSelector({ startDate, endDate, selectedDates, onChange }: DateSelectorProps) {
	const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

	const months = useMemo(() => {
		if (!startDate || !endDate) return [];
		const start = new Date(`${startDate}T00:00:00`);
		const end = new Date(`${endDate}T00:00:00`);
		const result: Array<{ year: number; month: number }> = [];
		const current = new Date(start.getFullYear(), start.getMonth(), 1);
		while (current <= end) {
			result.push({ year: current.getFullYear(), month: current.getMonth() });
			current.setMonth(current.getMonth() + 1);
		}
		return result;
	}, [startDate, endDate]);

	const allDatesInRange = useMemo(() => {
		if (!startDate || !endDate) return [];
		const dates: string[] = [];
		const current = new Date(`${startDate}T00:00:00`);
		const end = new Date(`${endDate}T00:00:00`);
		while (current <= end) {
			dates.push(
				`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`,
			);
			current.setDate(current.getDate() + 1);
		}
		return dates;
	}, [startDate, endDate]);

	const isInRange = useCallback(
		(dateStr: string) => {
			return dateStr >= startDate && dateStr <= endDate;
		},
		[startDate, endDate],
	);

	const toggleDate = useCallback(
		(dateStr: string) => {
			if (selectedSet.has(dateStr)) {
				onChange(selectedDates.filter((d) => d !== dateStr));
			} else {
				onChange([...selectedDates, dateStr].sort());
			}
		},
		[selectedDates, selectedSet, onChange],
	);

	const selectAll = useCallback(() => {
		onChange([...allDatesInRange]);
	}, [allDatesInRange, onChange]);

	const selectWeekdays = useCallback(() => {
		const weekdays = allDatesInRange.filter((d) => {
			const day = new Date(`${d}T00:00:00`).getDay();
			return day !== 0 && day !== 6;
		});
		onChange(weekdays);
	}, [allDatesInRange, onChange]);

	const clearAll = useCallback(() => {
		onChange([]);
	}, [onChange]);

	if (!startDate || !endDate) {
		return (
			<div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
				Select a date range above to choose specific days
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={selectWeekdays}
					className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					Weekdays (Mon–Fri)
				</button>
				<button
					type="button"
					onClick={selectAll}
					className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					All Days
				</button>
				<button
					type="button"
					onClick={clearAll}
					className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					Clear All
				</button>
				<span className="ml-auto self-center text-xs text-slate-500">
					{selectedDates.length} day{selectedDates.length !== 1 ? "s" : ""} selected
				</span>
			</div>

			<div className="grid gap-6 sm:grid-cols-2">
				{months.map(({ year, month }) => (
					<MonthGrid
						key={`${year}-${month}`}
						year={year}
						month={month}
						selectedSet={selectedSet}
						isInRange={isInRange}
						onToggle={toggleDate}
					/>
				))}
			</div>
		</div>
	);
}

function MonthGrid({
	year,
	month,
	selectedSet,
	isInRange,
	onToggle,
}: {
	year: number;
	month: number;
	selectedSet: Set<string>;
	isInRange: (d: string) => boolean;
	onToggle: (d: string) => void;
}) {
	const daysInMonth = getDaysInMonth(year, month);
	const firstDay = getFirstDayOfWeek(year, month);

	const cells: Array<
		{ key: string; day: number; dateStr: string; inRange: boolean } | { key: string }
	> = [];
	for (let i = 0; i < firstDay; i++) {
		cells.push({ key: `empty-${year}-${month}-pre${i}` });
	}
	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = toDateString(year, month, day);
		cells.push({ key: dateStr, day, dateStr, inRange: isInRange(dateStr) });
	}

	return (
		<div className="rounded-lg border border-slate-200 bg-white p-4">
			<h4 className="mb-3 text-center text-sm font-semibold text-slate-900">
				{formatMonthYear(year, month)}
			</h4>
			<div className="grid grid-cols-7 gap-1">
				{DAY_HEADERS.map((d) => (
					<div key={d} className="py-1 text-center text-xs font-medium text-slate-400">
						{d}
					</div>
				))}
				{cells.map((cell) => {
					if (!("day" in cell)) {
						return <div key={cell.key} />;
					}
					const { day, dateStr, inRange } = cell;
					const selected = selectedSet.has(dateStr);
					return (
						<button
							key={cell.key}
							type="button"
							disabled={!inRange}
							onClick={() => onToggle(dateStr)}
							className={`flex h-9 w-full items-center justify-center rounded-md text-sm transition-all ${
								!inRange
									? "cursor-not-allowed text-slate-300"
									: selected
										? "bg-emerald-600 font-medium text-white shadow-sm hover:bg-emerald-700"
										: "text-slate-700 hover:bg-emerald-50"
							}`}
						>
							{day}
						</button>
					);
				})}
			</div>
		</div>
	);
}
