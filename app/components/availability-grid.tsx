import { Check, HelpCircle, X } from "lucide-react";
import { useCallback } from "react";
import { formatDateDisplay } from "~/lib/date-utils";

type AvailabilityStatus = "available" | "maybe" | "not_available";

interface AvailabilityGridProps {
	dates: string[];
	responses: Record<string, AvailabilityStatus>;
	onChange: (responses: Record<string, AvailabilityStatus>) => void;
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
	disabled,
	timeRange,
	timezone,
}: AvailabilityGridProps) {
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
											</div>
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
						</div>
					);
				})}
			</div>
		</div>
	);
}
