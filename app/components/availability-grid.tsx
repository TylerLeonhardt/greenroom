import { Check, HelpCircle, MessageSquarePlus, X } from "lucide-react";
import { useCallback, useState } from "react";
import { formatDateDisplay } from "~/lib/date-utils";

type AvailabilityStatus = "available" | "maybe" | "not_available";

interface AvailabilityGridProps {
	dates: string[];
	responses: Record<string, AvailabilityStatus>;
	onChange: (responses: Record<string, AvailabilityStatus>) => void;
	notes?: Record<string, string>;
	onNotesChange?: (notes: Record<string, string>) => void;
	disabled?: boolean;
	timeRange?: string | null;
	timezone?: string | null;
}

const statusConfig = {
	available: {
		label: "Available",
		icon: Check,
		activeClass: "bg-emerald-600 text-white shadow-sm",
		hoverClass: "hover:bg-emerald-50 hover:text-emerald-700",
	},
	maybe: {
		label: "Maybe",
		icon: HelpCircle,
		activeClass: "bg-amber-500 text-white shadow-sm",
		hoverClass: "hover:bg-amber-50 hover:text-amber-700",
	},
	not_available: {
		label: "Unavailable",
		icon: X,
		activeClass: "bg-rose-600 text-white shadow-sm",
		hoverClass: "hover:bg-rose-50 hover:text-rose-700",
	},
} as const;

export function AvailabilityGrid({
	dates,
	responses,
	onChange,
	notes = {},
	onNotesChange,
	disabled,
	timeRange,
	timezone,
}: AvailabilityGridProps) {
	const [expandedNotes, setExpandedNotes] = useState<Set<string>>(() => {
		// Auto-expand dates that already have notes
		return new Set(Object.keys(notes).filter((k) => notes[k]));
	});

	const setStatus = useCallback(
		(date: string, status: AvailabilityStatus) => {
			onChange({ ...responses, [date]: status });
		},
		[responses, onChange],
	);

	const fillAll = useCallback(
		(status: AvailabilityStatus) => {
			const updated: Record<string, AvailabilityStatus> = {};
			for (const date of dates) {
				updated[date] = status;
			}
			onChange(updated);
		},
		[dates, onChange],
	);

	const clearAll = useCallback(() => {
		onChange({});
	}, [onChange]);

	const toggleNoteExpanded = useCallback((date: string) => {
		setExpandedNotes((prev) => {
			const next = new Set(prev);
			if (next.has(date)) {
				next.delete(date);
			} else {
				next.add(date);
			}
			return next;
		});
	}, []);

	const updateNote = useCallback(
		(date: string, value: string) => {
			if (!onNotesChange) return;
			const updated = { ...notes, [date]: value };
			if (!value) {
				delete updated[date];
			}
			onNotesChange(updated);
		},
		[notes, onNotesChange],
	);

	return (
		<div className="space-y-4">
			{timeRange && (
				<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
					⏰ Time: <span className="font-medium text-slate-900">{timeRange}</span> each day
				</div>
			)}
			{!disabled && (
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => fillAll("available")}
						className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
					>
						<Check className="h-3.5 w-3.5" /> All Available
					</button>
					<button
						type="button"
						onClick={() => fillAll("not_available")}
						className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50"
					>
						<X className="h-3.5 w-3.5" /> All Unavailable
					</button>
					<button
						type="button"
						onClick={clearAll}
						className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
					>
						Clear
					</button>
				</div>
			)}

			{/* Desktop table */}
			<div className="hidden sm:block">
				<div className="overflow-hidden rounded-xl border border-slate-200">
					<table className="w-full">
						<thead>
							<tr className="bg-slate-50">
								<th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Day</th>
								<th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Status</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{dates.map((date) => {
								const { dayOfWeek, display } = formatDateDisplay(date, timezone ?? undefined);
								const current = responses[date];
								return (
									<tr key={date} className="transition-colors hover:bg-slate-50/50">
										<td className="px-4 py-3 text-sm font-medium text-slate-900">{display}</td>
										<td className="px-4 py-3 text-sm text-slate-500">{dayOfWeek}</td>
										<td className="px-4 py-3">
											<div className="flex items-center justify-center gap-1.5">
												{(["available", "maybe", "not_available"] as const).map((status) => {
													const config = statusConfig[status];
													const Icon = config.icon;
													const isActive = current === status;
													return (
														<button
															key={status}
															type="button"
															disabled={disabled}
															onClick={() => setStatus(date, status)}
															className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
																isActive
																	? config.activeClass
																	: `border border-slate-200 text-slate-500 ${disabled ? "cursor-not-allowed opacity-50" : config.hoverClass}`
															}`}
															title={config.label}
														>
															<Icon className="h-3.5 w-3.5" />
															<span className="hidden lg:inline">{config.label}</span>
														</button>
													);
												})}
												{!disabled && onNotesChange && (
													<button
														type="button"
														onClick={() => toggleNoteExpanded(date)}
														className={`ml-1 inline-flex items-center rounded-lg p-1.5 text-xs transition-colors ${
															expandedNotes.has(date) || notes[date]
																? "text-emerald-600 hover:bg-emerald-50"
																: "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
														}`}
														title={expandedNotes.has(date) ? "Hide note" : "Add note"}
													>
														<MessageSquarePlus className="h-3.5 w-3.5" />
													</button>
												)}
											</div>
											{(expandedNotes.has(date) || notes[date]) && !disabled && onNotesChange && (
												<div className="mt-1.5">
													<input
														type="text"
														value={notes[date] ?? ""}
														onChange={(e) => updateNote(date, e.target.value)}
														maxLength={200}
														placeholder="Add a note..."
														aria-label={`Note for ${display}`}
														className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
													/>
												</div>
											)}
											{notes[date] && disabled && (
												<p className="mt-1 text-xs text-slate-500 italic">{notes[date]}</p>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* Mobile cards */}
			<div className="space-y-2 sm:hidden">
				{dates.map((date) => {
					const { dayOfWeek, display } = formatDateDisplay(date, timezone ?? undefined);
					const current = responses[date];
					return (
						<div key={date} className="rounded-xl border border-slate-200 bg-white p-4">
							<div className="mb-3 flex items-center justify-between">
								<span className="text-sm font-medium text-slate-900">{display}</span>
								<span className="text-xs text-slate-500">{dayOfWeek}</span>
							</div>
							<div className="flex gap-1.5">
								{(["available", "maybe", "not_available"] as const).map((status) => {
									const config = statusConfig[status];
									const Icon = config.icon;
									const isActive = current === status;
									return (
										<button
											key={status}
											type="button"
											disabled={disabled}
											onClick={() => setStatus(date, status)}
											className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
												isActive
													? config.activeClass
													: `border border-slate-200 text-slate-500 ${disabled ? "cursor-not-allowed opacity-50" : config.hoverClass}`
											}`}
										>
											<Icon className="h-3.5 w-3.5" />
											{config.label}
										</button>
									);
								})}
							</div>
							{!disabled && onNotesChange && (
								<div className="mt-2">
									<button
										type="button"
										onClick={() => toggleNoteExpanded(date)}
										className={`inline-flex items-center gap-1 text-xs transition-colors ${
											expandedNotes.has(date) || notes[date]
												? "text-emerald-600"
												: "text-slate-400 hover:text-slate-600"
										}`}
									>
										<MessageSquarePlus className="h-3.5 w-3.5" />
										{notes[date] ? "Edit note" : "Add note"}
									</button>
									{(expandedNotes.has(date) || notes[date]) && (
										<input
											type="text"
											value={notes[date] ?? ""}
											onChange={(e) => updateNote(date, e.target.value)}
											maxLength={200}
											placeholder="Add a note..."
											aria-label={`Note for ${display}`}
											className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
										/>
									)}
								</div>
							)}
							{notes[date] && disabled && (
								<p className="mt-2 text-xs text-slate-500 italic">{notes[date]}</p>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
