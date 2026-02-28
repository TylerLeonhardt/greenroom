import { Check, ChevronDown, ChevronRight, HelpCircle, Star, X } from "lucide-react";
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

interface ResultsHeatmapProps {
	dates: DateResult[];
	totalMembers: number;
	totalResponded: number;
	groupId: string;
	requestId?: string;
	timeRange?: string | null;
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
}: ResultsHeatmapProps) {
	const [expandedDate, setExpandedDate] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<"date" | "score">("date");

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

			{/* Desktop heatmap table */}
			<div className="hidden sm:block">
				<div className="overflow-hidden rounded-xl border border-slate-200">
					<table className="w-full">
						<thead>
							<tr className="bg-slate-50">
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
								const { dayOfWeek, display } = formatDateDisplay(row.date);
								const isExpanded = expandedDate === row.date;
								const isBest = topDateSet.has(row.date) && row.score > 0;
								return (
									<Fragment key={row.date}>
										<tr
											className={`cursor-pointer transition-colors ${getHeatColor(row.score, maxScore)} hover:bg-slate-100/50`}
											onClick={() => setExpandedDate(isExpanded ? null : row.date)}
										>
											<td className="px-3 py-3 text-center">
												{isExpanded ? (
													<ChevronDown className="inline h-4 w-4 text-slate-400" />
												) : (
													<ChevronRight className="inline h-4 w-4 text-slate-400" />
												)}
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
												<a
													href={`/groups/${groupId}/events/new?date=${row.date}${requestId ? `&fromRequest=${requestId}` : ""}`}
													onClick={(e) => e.stopPropagation()}
													className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
												>
													Create Event
												</a>
											</td>
										</tr>
										{isExpanded && (
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
					const { dayOfWeek, display } = formatDateDisplay(row.date);
					const isExpanded = expandedDate === row.date;
					const isBest = topDateSet.has(row.date) && row.score > 0;
					return (
						<div
							key={row.date}
							className={`overflow-hidden rounded-xl border border-slate-200 ${getHeatColor(row.score, maxScore)}`}
						>
							<button
								type="button"
								onClick={() => setExpandedDate(isExpanded ? null : row.date)}
								className="flex w-full items-center justify-between p-4 text-left"
							>
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
								<div className="flex items-center gap-2">
									<span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">
										{row.score}
									</span>
									{isExpanded ? (
										<ChevronDown className="h-4 w-4 text-slate-400" />
									) : (
										<ChevronRight className="h-4 w-4 text-slate-400" />
									)}
								</div>
							</button>
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
		</div>
	);
}
