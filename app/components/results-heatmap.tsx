import {
	Check,
	CheckSquare,
	ChevronDown,
	ChevronRight,
	HelpCircle,
	Square,
	Star,
	X,
} from "lucide-react";
import { Fragment, useCallback, useState } from "react";
import { formatDateDisplay } from "~/lib/date-utils";

interface DateResult {
	date: string;
	available: number;
	maybe: number;
	notAvailable: number;
	noResponse: number;
	total: number;
	score: number;
	respondents: Array<{ name: string; status: string }>;
}

interface ResultsHeatmapProps {
	dates: DateResult[];
	totalMembers: number;
	totalResponded: number;
	groupId: string;
	requestId?: string;
	timeRange?: string | null;
	timezone?: string | null;
	batchMode?: boolean;
	onBatchCreate?: (dates: string[]) => void;
}

function getHeatColor(score: number, maxScore: number): string {
	if (maxScore === 0) return "bg-slate-50";
	const ratio = score / maxScore;
	if (ratio >= 0.8) return "bg-emerald-100";
	if (ratio >= 0.6) return "bg-emerald-50";
	if (ratio >= 0.4) return "bg-amber-50";
	if (ratio >= 0.2) return "bg-rose-50";
	return "bg-rose-100";
}

const statusIcon: Record<string, React.ReactNode> = {
	available: <Check className="inline h-3.5 w-3.5 text-emerald-600" />,
	maybe: <HelpCircle className="inline h-3.5 w-3.5 text-amber-500" />,
	not_available: <X className="inline h-3.5 w-3.5 text-rose-600" />,
};

const statusLabel: Record<string, string> = {
	available: "Available",
	maybe: "Maybe",
	not_available: "Unavailable",
};

export function ResultsHeatmap({
	dates,
	totalMembers,
	totalResponded,
	groupId,
	requestId,
	timeRange,
	timezone,
	batchMode,
	onBatchCreate,
}: ResultsHeatmapProps) {
	const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
	const [sortBy, setSortBy] = useState<"date" | "score">("date");
	const [batchSelecting, setBatchSelecting] = useState(false);
	const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

	const toggleExpanded = useCallback((date: string) => {
		setExpandedDates((prev) => {
			const next = new Set(prev);
			if (next.has(date)) {
				next.delete(date);
			} else {
				next.add(date);
			}
			return next;
		});
	}, []);

	const toggleDate = useCallback((date: string) => {
		setSelectedDates((prev) => {
			const next = new Set(prev);
			if (next.has(date)) {
				next.delete(date);
			} else {
				next.add(date);
			}
			return next;
		});
	}, []);

	const selectTopN = useCallback(
		(n: number) => {
			const topN = [...dates].sort((a, b) => b.score - a.score).slice(0, n);
			setSelectedDates(new Set(topN.map((d) => d.date)));
		},
		[dates],
	);

	const clearSelection = useCallback(() => {
		setSelectedDates(new Set());
	}, []);

	const handleBatchCreate = useCallback(() => {
		if (onBatchCreate && selectedDates.size > 0) {
			onBatchCreate(Array.from(selectedDates));
		}
	}, [onBatchCreate, selectedDates]);

	const maxScore = Math.max(...dates.map((d) => d.score), 1);
	const topDates = [...dates].sort((a, b) => b.score - a.score).slice(0, 3);
	const topDateSet = new Set(topDates.map((d) => d.date));

	const sortedDates = sortBy === "score" ? [...dates].sort((a, b) => b.score - a.score) : dates;

	return (
		<div className="space-y-4">
			{/* Time range indicator */}
			{timeRange && (
				<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
					⏰ Time: <span className="font-medium text-slate-900">{timeRange}</span> each day
				</div>
			)}
			{/* Summary bar */}
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-4 text-sm">
					<span className="text-slate-600">
						<span className="font-semibold text-slate-900">{totalResponded}</span>/{totalMembers}{" "}
						responded
					</span>
					<div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
						<div
							className="h-full rounded-full bg-emerald-500 transition-all"
							style={{
								width: `${totalMembers > 0 ? (totalResponded / totalMembers) * 100 : 0}%`,
							}}
						/>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-slate-500">Sort by:</span>
					<button
						type="button"
						onClick={() => setSortBy("date")}
						className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
							sortBy === "date" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
						}`}
					>
						Date
					</button>
					<button
						type="button"
						onClick={() => setSortBy("score")}
						className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
							sortBy === "score" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
						}`}
					>
						Best First
					</button>
				</div>
			</div>

			{/* Batch selection controls */}
			{batchMode && (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3">
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => {
								setBatchSelecting(!batchSelecting);
								if (batchSelecting) clearSelection();
							}}
							className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
								batchSelecting
									? "bg-emerald-600 text-white"
									: "border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
							}`}
						>
							{batchSelecting ? "Cancel Selection" : "Select Dates"}
						</button>
						{batchSelecting && (
							<>
								<button
									type="button"
									onClick={() => selectTopN(5)}
									className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
								>
									Select Top 5
								</button>
								<button
									type="button"
									onClick={() => setSelectedDates(new Set(dates.map((d) => d.date)))}
									className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
								>
									Select All
								</button>
								{selectedDates.size > 0 && (
									<button
										type="button"
										onClick={clearSelection}
										className="text-xs text-slate-500 hover:text-slate-700"
									>
										Clear
									</button>
								)}
							</>
						)}
					</div>
					{batchSelecting && selectedDates.size > 0 && (
						<div className="flex items-center gap-3">
							<span className="text-sm font-medium text-slate-700">
								{selectedDates.size} date{selectedDates.size !== 1 ? "s" : ""} selected
							</span>
							<button
								type="button"
								onClick={handleBatchCreate}
								className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
							>
								Create {selectedDates.size} Event{selectedDates.size !== 1 ? "s" : ""} →
							</button>
						</div>
					)}
				</div>
			)}

			{/* Desktop heatmap table */}
			<div className="hidden sm:block">
				<div className="overflow-hidden rounded-xl border border-slate-200">
					<table className="w-full">
						<thead>
							<tr className="bg-slate-50">
								{batchSelecting && <th className="w-8 px-2 py-3" />}
								<th className="w-8 px-3 py-3" />
								<th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Day</th>
								<th className="px-3 py-3 text-center text-xs font-medium text-emerald-600">✅</th>
								<th className="px-3 py-3 text-center text-xs font-medium text-amber-500">🤔</th>
								<th className="px-3 py-3 text-center text-xs font-medium text-rose-600">❌</th>
								<th className="px-3 py-3 text-center text-xs font-medium text-slate-400">—</th>
								<th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Score</th>
								<th className="px-4 py-3 text-right text-xs font-medium text-slate-500" />
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{sortedDates.map((row) => {
								const { dayOfWeek, display } = formatDateDisplay(row.date, timezone ?? undefined);
								const isExpanded = expandedDates.has(row.date);
								const isBest = topDateSet.has(row.date) && row.score > 0;
								return (
									<Fragment key={row.date}>
										<tr
											className={`cursor-pointer transition-colors ${
												batchSelecting && selectedDates.has(row.date)
													? "bg-emerald-100 hover:bg-emerald-200/70"
													: `${getHeatColor(row.score, maxScore)} hover:bg-slate-100/50`
											}`}
											onClick={() => {
												if (batchSelecting) {
													toggleDate(row.date);
												} else {
													toggleExpanded(row.date);
												}
											}}
										>
											{batchSelecting && (
												<td className="px-2 py-3 text-center">
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															toggleDate(row.date);
														}}
														onKeyDown={(e) => {
															if (e.key === "Enter" || e.key === " ") {
																e.stopPropagation();
															}
														}}
													>
														{selectedDates.has(row.date) ? (
															<CheckSquare className="inline h-4 w-4 text-emerald-600" />
														) : (
															<Square className="inline h-4 w-4 text-slate-400" />
														)}
													</button>
												</td>
											)}
											<td className="px-3 py-3 text-center">
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														toggleExpanded(row.date);
													}}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.stopPropagation();
														}
													}}
												>
													{isExpanded ? (
														<ChevronDown className="inline h-4 w-4 text-slate-400" />
													) : (
														<ChevronRight className="inline h-4 w-4 text-slate-400" />
													)}
												</button>
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center gap-2">
													<span className="text-sm font-medium text-slate-900">{display}</span>
													{isBest && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
												</div>
											</td>
											<td className="px-4 py-3 text-sm text-slate-500">{dayOfWeek}</td>
											<td className="px-3 py-3 text-center text-sm font-medium text-emerald-700">
												{row.available}
											</td>
											<td className="px-3 py-3 text-center text-sm font-medium text-amber-600">
												{row.maybe}
											</td>
											<td className="px-3 py-3 text-center text-sm font-medium text-rose-600">
												{row.notAvailable}
											</td>
											<td className="px-3 py-3 text-center text-sm text-slate-400">
												{row.noResponse}
											</td>
											<td className="px-4 py-3 text-center">
												<span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">
													{row.score}
												</span>
											</td>
											<td className="px-4 py-3 text-right">
												{!batchSelecting && (
													<a
														href={`/groups/${groupId}/events/new?date=${row.date}${requestId ? `&fromRequest=${requestId}` : ""}`}
														onClick={(e) => e.stopPropagation()}
														className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
													>
														Create Event
													</a>
												)}
											</td>
										</tr>
										{isExpanded && (
											<tr key={`${row.date}-detail`}>
												<td colSpan={batchSelecting ? 10 : 9} className="bg-slate-50 px-8 py-4">
													<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
														{row.respondents.length > 0 ? (
															row.respondents.map((r) => (
																<div key={r.name} className="flex items-center gap-2 text-sm">
																	{statusIcon[r.status]}
																	<span className="text-slate-700">{r.name}</span>
																	<span className="text-xs text-slate-400">
																		{statusLabel[r.status]}
																	</span>
																</div>
															))
														) : (
															<span className="text-sm text-slate-400">No responses yet</span>
														)}
													</div>
												</td>
											</tr>
										)}
									</Fragment>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* Mobile cards */}
			<div className="space-y-2 sm:hidden">
				{sortedDates.map((row) => {
					const { dayOfWeek, display } = formatDateDisplay(row.date, timezone ?? undefined);
					const isExpanded = expandedDates.has(row.date);
					const isBest = topDateSet.has(row.date) && row.score > 0;
					return (
						<div
							key={row.date}
							className={`overflow-hidden rounded-xl border ${
								batchSelecting && selectedDates.has(row.date)
									? "border-emerald-300 bg-emerald-100"
									: `border-slate-200 ${getHeatColor(row.score, maxScore)}`
							}`}
						>
							{/* biome-ignore lint/a11y/useSemanticElements: div required to avoid nested button nesting violation */}
							<div
								role="button"
								tabIndex={0}
								onClick={() => {
									if (batchSelecting) {
										toggleDate(row.date);
									} else {
										toggleExpanded(row.date);
									}
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										if (batchSelecting) {
											toggleDate(row.date);
										} else {
											toggleExpanded(row.date);
										}
									}
								}}
								className="flex w-full items-center justify-between p-4 text-left"
							>
								<div className="flex items-center gap-3">
									{batchSelecting && (
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												toggleDate(row.date);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.stopPropagation();
												}
											}}
										>
											{selectedDates.has(row.date) ? (
												<CheckSquare className="h-4 w-4 text-emerald-600" />
											) : (
												<Square className="h-4 w-4 text-slate-400" />
											)}
										</button>
									)}
									<div>
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-slate-900">{display}</span>
											<span className="text-xs text-slate-500">{dayOfWeek}</span>
											{isBest && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
										</div>
										<div className="mt-1 flex items-center gap-3 text-xs">
											<span className="text-emerald-700">✅ {row.available}</span>
											<span className="text-amber-600">🤔 {row.maybe}</span>
											<span className="text-rose-600">❌ {row.notAvailable}</span>
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">
										{row.score}
									</span>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											toggleExpanded(row.date);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.stopPropagation();
											}
										}}
										className="p-1"
									>
										{isExpanded ? (
											<ChevronDown className="h-4 w-4 text-slate-400" />
										) : (
											<ChevronRight className="h-4 w-4 text-slate-400" />
										)}
									</button>
								</div>
							</div>
							{isExpanded && (
								<div className="border-t border-slate-200 bg-white p-4">
									<div className="space-y-2">
										{row.respondents.length > 0 ? (
											row.respondents.map((r) => (
												<div key={r.name} className="flex items-center gap-2 text-sm">
													{statusIcon[r.status]}
													<span className="text-slate-700">{r.name}</span>
												</div>
											))
										) : (
											<span className="text-sm text-slate-400">No responses yet</span>
										)}
									</div>
									<a
										href={`/groups/${groupId}/events/new?date=${row.date}${requestId ? `&fromRequest=${requestId}` : ""}`}
										className="mt-3 inline-block text-xs font-medium text-emerald-600 hover:text-emerald-700"
									>
										Create Event →
									</a>
								</div>
							)}
						</div>
					);
				})}
			</div>
			{/* Mobile floating batch action bar */}
			{batchMode && batchSelecting && selectedDates.size > 0 && (
				<div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white p-4 shadow-lg sm:hidden">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium text-slate-700">
							{selectedDates.size} date{selectedDates.size !== 1 ? "s" : ""}
						</span>
						<button
							type="button"
							onClick={handleBatchCreate}
							className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
						>
							Create {selectedDates.size} Event{selectedDates.size !== 1 ? "s" : ""} →
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
