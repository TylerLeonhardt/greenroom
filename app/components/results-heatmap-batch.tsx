import { Check, CheckCircle2, ChevronDown, ChevronRight, HelpCircle, Star, X } from "lucide-react";
import { Fragment, useState } from "react";
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

interface ResultsHeatmapBatchProps {
	dates: DateResult[];
	totalMembers: number;
	totalResponded: number;
	groupId: string;
	requestId?: string;
	timeRange?: string | null;
	timezone?: string | null;
	onBatchCreate: (selectedDates: string[]) => void;
}

function getHeatColor(score: number, maxScore: number, isSelected: boolean): string {
	if (isSelected) return "bg-emerald-200 border-emerald-500";
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

export function ResultsHeatmapBatch({
	dates,
	totalMembers,
	totalResponded,
	groupId,
	requestId,
	timeRange,
	timezone,
	onBatchCreate,
}: ResultsHeatmapBatchProps) {
	const [expandedDate, setExpandedDate] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<"date" | "score">("date");
	const [batchMode, setBatchMode] = useState(false);
	const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

	const maxScore = Math.max(...dates.map((d) => d.score), 1);
	const topDates = [...dates].sort((a, b) => b.score - a.score).slice(0, 3);
	const topDateSet = new Set(topDates.map((d) => d.date));

	const sortedDates = sortBy === "score" ? [...dates].sort((a, b) => b.score - a.score) : dates;

	const toggleDateSelection = (date: string) => {
		const newSelected = new Set(selectedDates);
		if (newSelected.has(date)) {
			newSelected.delete(date);
		} else {
			newSelected.add(date);
		}
		setSelectedDates(newSelected);
	};

	const handleBatchCreate = () => {
		const sortedSelectedDates = Array.from(selectedDates).sort();
		onBatchCreate(sortedSelectedDates);
	};

	const selectTopDates = () => {
		const top = [...dates].sort((a, b) => b.score - a.score).slice(0, 5);
		setSelectedDates(new Set(top.map((d) => d.date)));
	};

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

			{/* Batch mode controls */}
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => {
							setBatchMode(!batchMode);
							setSelectedDates(new Set());
						}}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
							batchMode
								? "bg-emerald-600 text-white shadow-md hover:bg-emerald-700"
								: "bg-white text-slate-700 shadow-sm hover:bg-slate-50"
						}`}
					>
						{batchMode ? "✓ Multi-Select Mode" : "Enable Multi-Select"}
					</button>
					{batchMode && selectedDates.size === 0 && (
						<button
							type="button"
							onClick={selectTopDates}
							className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
						>
							Select Top 5 →
						</button>
					)}
					{batchMode && selectedDates.size > 0 && (
						<>
							<span className="text-sm font-medium text-slate-900">
								{selectedDates.size} date{selectedDates.size !== 1 ? "s" : ""} selected
							</span>
							<button
								type="button"
								onClick={() => setSelectedDates(new Set())}
								className="text-sm text-slate-500 hover:text-slate-700"
							>
								Clear
							</button>
						</>
					)}
				</div>
				{batchMode && selectedDates.size > 0 && (
					<button
						type="button"
						onClick={handleBatchCreate}
						className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
					>
						Create {selectedDates.size} Events →
					</button>
				)}
			</div>

			{/* Desktop heatmap table */}
			<div className="hidden sm:block">
				<div className="overflow-hidden rounded-xl border border-slate-200">
					<table className="w-full">
						<thead>
							<tr className="bg-slate-50">
								{batchMode && <th className="w-12 px-3 py-3" />}
								<th className="w-8 px-3 py-3" />
								<th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Day</th>
								<th className="px-3 py-3 text-center text-xs font-medium text-emerald-600">✅</th>
								<th className="px-3 py-3 text-center text-xs font-medium text-amber-500">🤔</th>
								<th className="px-3 py-3 text-center text-xs font-medium text-rose-600">❌</th>
								<th className="px-3 py-3 text-center text-xs font-medium text-slate-400">—</th>
								<th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Score</th>
								{!batchMode && (
									<th className="px-4 py-3 text-right text-xs font-medium text-slate-500" />
								)}
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{sortedDates.map((row) => {
								const { dayOfWeek, display } = formatDateDisplay(row.date, timezone ?? undefined);
								const isExpanded = expandedDate === row.date;
								const isBest = topDateSet.has(row.date) && row.score > 0;
								const isSelected = selectedDates.has(row.date);
								return (
									<Fragment key={row.date}>
										<tr
											className={`transition-colors ${getHeatColor(row.score, maxScore, isSelected)} ${
												batchMode
													? "cursor-pointer hover:opacity-80"
													: "cursor-pointer hover:bg-slate-100/50"
											} ${isSelected ? "border-2 border-emerald-500" : ""}`}
											onClick={() => {
												if (batchMode) {
													toggleDateSelection(row.date);
												} else {
													setExpandedDate(isExpanded ? null : row.date);
												}
											}}
										>
											{batchMode && (
												<td className="px-3 py-3 text-center">
													<div
														className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
															isSelected
																? "border-emerald-600 bg-emerald-600"
																: "border-slate-300 bg-white"
														}`}
													>
														{isSelected && <Check className="h-3.5 w-3.5 text-white" />}
													</div>
												</td>
											)}
											<td className="px-3 py-3 text-center">
												{!batchMode &&
													(isExpanded ? (
														<ChevronDown className="inline h-4 w-4 text-slate-400" />
													) : (
														<ChevronRight className="inline h-4 w-4 text-slate-400" />
													))}
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
											{!batchMode && (
												<td className="px-4 py-3 text-right">
													<a
														href={`/groups/${groupId}/events/new?date=${row.date}${requestId ? `&fromRequest=${requestId}` : ""}`}
														onClick={(e) => e.stopPropagation()}
														className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
													>
														Create Event
													</a>
												</td>
											)}
										</tr>
										{!batchMode && isExpanded && (
											<tr key={`${row.date}-detail`}>
												<td colSpan={9} className="bg-slate-50 px-8 py-4">
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
					const isExpanded = expandedDate === row.date;
					const isBest = topDateSet.has(row.date) && row.score > 0;
					const isSelected = selectedDates.has(row.date);
					return (
						<div
							key={row.date}
							className={`overflow-hidden rounded-xl border-2 ${
								isSelected ? "border-emerald-500" : "border-slate-200"
							} ${getHeatColor(row.score, maxScore, isSelected)}`}
						>
							<button
								type="button"
								onClick={() => {
									if (batchMode) {
										toggleDateSelection(row.date);
									} else {
										setExpandedDate(isExpanded ? null : row.date);
									}
								}}
								className="flex w-full items-center justify-between p-4 text-left"
							>
								<div className="flex items-center gap-3">
									{batchMode && (
										<div
											className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
												isSelected
													? "border-emerald-600 bg-emerald-600"
													: "border-slate-300 bg-white"
											}`}
										>
											{isSelected && <Check className="h-3.5 w-3.5 text-white" />}
										</div>
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
									{!batchMode &&
										(isExpanded ? (
											<ChevronDown className="h-4 w-4 text-slate-400" />
										) : (
											<ChevronRight className="h-4 w-4 text-slate-400" />
										))}
								</div>
							</button>
							{!batchMode && isExpanded && (
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
		</div>
	);
}
