import type { MetaFunction } from "@remix-run/node";
import {
	ArrowLeft,
	ArrowRight,
	Calendar,
	Check,
	CheckCircle2,
	Clock,
	HelpCircle,
	MapPin,
	RotateCcw,
	Send,
	Sparkles,
	Star,
	Users,
	X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export const meta: MetaFunction = () => [{ title: "Batch Heatmap Demo — My Call Time" }];

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_MEMBERS = [
	{ id: "1", name: "Alice Chen" },
	{ id: "2", name: "Bob Martinez" },
	{ id: "3", name: "Charlie Kim" },
	{ id: "4", name: "Diana Patel" },
	{ id: "5", name: "Eve Johnson" },
	{ id: "6", name: "Frank Williams" },
];

const MOCK_DATES = [
	"2026-04-02",
	"2026-04-09",
	"2026-04-16",
	"2026-04-23",
	"2026-04-30",
	"2026-05-07",
	"2026-05-14",
	"2026-05-21",
	"2026-05-28",
	"2026-06-04",
	"2026-06-11",
	"2026-06-18",
];

type AvailStatus = "available" | "maybe" | "not_available";

const MOCK_RESPONSES: Record<string, Record<string, AvailStatus>> = {
	// Alice - very reliable, mostly available
	"1": {
		"2026-04-02": "available",
		"2026-04-09": "available",
		"2026-04-16": "available",
		"2026-04-23": "maybe",
		"2026-04-30": "available",
		"2026-05-07": "available",
		"2026-05-14": "available",
		"2026-05-21": "not_available",
		"2026-05-28": "available",
		"2026-06-04": "available",
		"2026-06-11": "available",
		"2026-06-18": "maybe",
	},
	// Bob - mixed schedule
	"2": {
		"2026-04-02": "available",
		"2026-04-09": "maybe",
		"2026-04-16": "not_available",
		"2026-04-23": "available",
		"2026-04-30": "available",
		"2026-05-07": "maybe",
		"2026-05-14": "available",
		"2026-05-21": "available",
		"2026-05-28": "not_available",
		"2026-06-04": "available",
		"2026-06-11": "maybe",
		"2026-06-18": "available",
	},
	// Charlie - available early, busy later
	"3": {
		"2026-04-02": "available",
		"2026-04-09": "available",
		"2026-04-16": "available",
		"2026-04-23": "available",
		"2026-04-30": "maybe",
		"2026-05-07": "available",
		"2026-05-14": "not_available",
		"2026-05-21": "not_available",
		"2026-05-28": "maybe",
		"2026-06-04": "not_available",
		"2026-06-11": "available",
		"2026-06-18": "not_available",
	},
	// Diana - very committed
	"4": {
		"2026-04-02": "available",
		"2026-04-09": "available",
		"2026-04-16": "maybe",
		"2026-04-23": "available",
		"2026-04-30": "available",
		"2026-05-07": "available",
		"2026-05-14": "available",
		"2026-05-21": "maybe",
		"2026-05-28": "available",
		"2026-06-04": "available",
		"2026-06-11": "available",
		"2026-06-18": "available",
	},
	// Eve - sporadic availability
	"5": {
		"2026-04-02": "maybe",
		"2026-04-09": "not_available",
		"2026-04-16": "available",
		"2026-04-23": "available",
		"2026-04-30": "not_available",
		"2026-05-07": "available",
		"2026-05-14": "maybe",
		"2026-05-21": "available",
		"2026-05-28": "available",
		"2026-06-04": "maybe",
		"2026-06-11": "not_available",
		"2026-06-18": "available",
	},
	// Frank - mostly free with some conflicts
	"6": {
		"2026-04-02": "available",
		"2026-04-09": "available",
		"2026-04-16": "available",
		"2026-04-23": "not_available",
		"2026-04-30": "available",
		"2026-05-07": "available",
		"2026-05-14": "available",
		"2026-05-21": "maybe",
		"2026-05-28": "available",
		"2026-06-04": "available",
		"2026-06-11": "available",
		"2026-06-18": "maybe",
	},
};

const DEFAULT_LOCATIONS = ["Main Stage", "Studio B", "Room 204", "The Black Box"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeScores(dates: string[]) {
	return dates.map((date) => {
		let available = 0;
		let maybe = 0;
		let notAvailable = 0;
		for (const member of MOCK_MEMBERS) {
			const status = MOCK_RESPONSES[member.id]?.[date];
			if (status === "available") available++;
			else if (status === "maybe") maybe++;
			else notAvailable++;
		}
		const score = available * 2 + maybe;
		return { date, available, maybe, notAvailable, score };
	});
}

function formatDateShort(dateStr: string) {
	const d = new Date(`${dateStr}T12:00:00`);
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayOfWeek(dateStr: string) {
	const d = new Date(`${dateStr}T12:00:00`);
	return d.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDateLong(dateStr: string) {
	const d = new Date(`${dateStr}T12:00:00`);
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function getScoreColor(score: number, maxScore: number) {
	const ratio = maxScore > 0 ? score / maxScore : 0;
	if (ratio >= 0.8) return "bg-emerald-100 text-emerald-800";
	if (ratio >= 0.6) return "bg-emerald-50 text-emerald-700";
	if (ratio >= 0.4) return "bg-amber-50 text-amber-700";
	if (ratio >= 0.2) return "bg-orange-50 text-orange-700";
	return "bg-rose-50 text-rose-700";
}

function _getScoreBg(score: number, maxScore: number) {
	const ratio = maxScore > 0 ? score / maxScore : 0;
	if (ratio >= 0.8) return "bg-emerald-500";
	if (ratio >= 0.6) return "bg-emerald-400";
	if (ratio >= 0.4) return "bg-amber-400";
	if (ratio >= 0.2) return "bg-orange-400";
	return "bg-rose-400";
}

// ─── Phase Components ────────────────────────────────────────────────────────

type Phase = 1 | 2 | 3 | 4;

function StatusIcon({ status }: { status: AvailStatus }) {
	if (status === "available") {
		return <Check className="h-4 w-4 text-emerald-600" />;
	}
	if (status === "maybe") {
		return <HelpCircle className="h-4 w-4 text-amber-500" />;
	}
	return <X className="h-4 w-4 text-rose-400" />;
}

function StatusCell({ status }: { status: AvailStatus }) {
	const bg =
		status === "available" ? "bg-emerald-50" : status === "maybe" ? "bg-amber-50" : "bg-rose-50";
	return (
		<td className={`px-2 py-2 text-center ${bg}`}>
			<span className="inline-flex items-center justify-center">
				<StatusIcon status={status} />
			</span>
		</td>
	);
}

function PhaseIndicator({ current }: { current: Phase }) {
	const phases = [
		{ num: 1, label: "Select Dates" },
		{ num: 2, label: "Configure" },
		{ num: 3, label: "Review" },
		{ num: 4, label: "Done" },
	];
	return (
		<div className="mb-8 flex items-center justify-center gap-2">
			{phases.map((p, i) => (
				<div key={p.num} className="flex items-center gap-2">
					<div
						className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
							p.num < current
								? "bg-emerald-600 text-white"
								: p.num === current
									? "bg-emerald-600 text-white ring-4 ring-emerald-100"
									: "bg-slate-100 text-slate-400"
						}`}
					>
						{p.num < current ? <Check className="h-4 w-4" /> : p.num}
					</div>
					<span
						className={`hidden text-sm font-medium sm:inline ${
							p.num === current ? "text-slate-900" : "text-slate-400"
						}`}
					>
						{p.label}
					</span>
					{i < phases.length - 1 && (
						<div
							className={`mx-1 h-px w-8 sm:w-12 ${
								p.num < current ? "bg-emerald-400" : "bg-slate-200"
							}`}
						/>
					)}
				</div>
			))}
		</div>
	);
}

// ─── Phase 1: Heatmap ───────────────────────────────────────────────────────

function HeatmapPhase({
	selected,
	onToggle,
	onSelectTop,
	onNext,
}: {
	selected: Set<string>;
	onToggle: (date: string) => void;
	onSelectTop: (n: number) => void;
	onNext: () => void;
}) {
	const scores = useMemo(() => computeScores(MOCK_DATES), []);
	const maxScore = useMemo(() => Math.max(...scores.map((s) => s.score)), [scores]);
	const allSelected = selected.size === MOCK_DATES.length;

	const toggleAll = useCallback(() => {
		if (allSelected) {
			for (const d of MOCK_DATES) onToggle(d);
		} else {
			for (const d of MOCK_DATES) {
				if (!selected.has(d)) onToggle(d);
			}
		}
	}, [allSelected, selected, onToggle]);

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-100 px-6 py-4">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<h2 className="text-lg font-semibold text-slate-900">
								Thursday Rehearsal Availability
							</h2>
							<p className="mt-0.5 text-sm text-slate-500">
								6 of 6 members responded · April – June 2026
							</p>
						</div>
						<div className="flex items-center gap-4 text-xs text-slate-500">
							<span className="flex items-center gap-1.5">
								<span className="inline-block h-3 w-3 rounded-sm bg-emerald-100" />
								Available
							</span>
							<span className="flex items-center gap-1.5">
								<span className="inline-block h-3 w-3 rounded-sm bg-amber-100" />
								Maybe
							</span>
							<span className="flex items-center gap-1.5">
								<span className="inline-block h-3 w-3 rounded-sm bg-rose-100" />
								Unavailable
							</span>
						</div>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
								<th className="px-3 py-3">
									<input
										type="checkbox"
										checked={allSelected}
										onChange={toggleAll}
										className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
									/>
								</th>
								<th className="px-3 py-3">Date</th>
								{MOCK_MEMBERS.map((m) => (
									<th key={m.id} className="px-2 py-3 text-center" title={m.name}>
										{m.name.split(" ")[0]}
									</th>
								))}
								<th className="px-3 py-3 text-center">Score</th>
							</tr>
						</thead>
						<tbody>
							{scores.map((row, idx) => {
								const isSelected = selected.has(row.date);
								return (
									<tr
										key={row.date}
										onClick={() => onToggle(row.date)}
										className={`cursor-pointer border-b border-slate-50 transition-colors ${
											isSelected
												? "bg-emerald-50/50"
												: idx % 2 === 0
													? "bg-white"
													: "bg-slate-50/30"
										} hover:bg-emerald-50/30`}
									>
										<td className="px-3 py-2">
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => onToggle(row.date)}
												onClick={(e) => e.stopPropagation()}
												className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
											/>
										</td>
										<td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">
											<span className="text-slate-400">{formatDayOfWeek(row.date)}</span>{" "}
											{formatDateShort(row.date)}
										</td>
										{MOCK_MEMBERS.map((m) => (
											<StatusCell
												key={m.id}
												status={MOCK_RESPONSES[m.id]?.[row.date] ?? "not_available"}
											/>
										))}
										<td className="px-3 py-2 text-center">
											<span
												className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getScoreColor(row.score, maxScore)}`}
											>
												{row.score}
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* Action Bar */}
			<div className="sticky bottom-0 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => onSelectTop(5)}
							className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
						>
							<Star className="h-4 w-4 text-amber-500" />
							Select Top 5
						</button>
						<span className="text-sm text-slate-500">
							{selected.size === 0 ? (
								"No dates selected"
							) : (
								<>
									<span className="font-semibold text-emerald-700">{selected.size}</span>{" "}
									{selected.size === 1 ? "date" : "dates"} selected
								</>
							)}
						</span>
					</div>
					<button
						type="button"
						onClick={onNext}
						disabled={selected.size === 0}
						className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Create {selected.size} {selected.size === 1 ? "Event" : "Events"}
						<ArrowRight className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── Phase 2: Batch Configure ────────────────────────────────────────────────

interface EventConfig {
	title: string;
	eventType: "rehearsal" | "show" | "other";
	description: string;
	startTime: string;
	endTime: string;
	locations: Record<string, string>;
}

function ConfigurePhase({
	selectedDates,
	config,
	onChange,
	onBack,
	onNext,
}: {
	selectedDates: string[];
	config: EventConfig;
	onChange: (config: EventConfig) => void;
	onBack: () => void;
	onNext: () => void;
}) {
	const [applyAllLocation, setApplyAllLocation] = useState("");

	const applyToAll = () => {
		if (!applyAllLocation.trim()) return;
		const newLocations: Record<string, string> = {};
		for (const d of selectedDates) {
			newLocations[d] = applyAllLocation.trim();
		}
		onChange({ ...config, locations: newLocations });
	};

	const setLocation = (date: string, value: string) => {
		onChange({
			...config,
			locations: { ...config.locations, [date]: value },
		});
	};

	return (
		<div className="space-y-6">
			{/* Shared Configuration */}
			<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="mb-4 text-lg font-semibold text-slate-900">Event Details</h2>
				<div className="space-y-4">
					<div>
						<label
							htmlFor="event-title"
							className="mb-1.5 block text-sm font-medium text-slate-700"
						>
							Event Title
						</label>
						<input
							id="event-title"
							type="text"
							value={config.title}
							onChange={(e) => onChange({ ...config, title: e.target.value })}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							placeholder="e.g. Thursday Rehearsal"
						/>
					</div>

					<div>
						<span className="mb-1.5 block text-sm font-medium text-slate-700">Event Type</span>
						<div className="flex gap-3">
							{(["rehearsal", "show", "other"] as const).map((type) => (
								<label
									key={type}
									className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
										config.eventType === type
											? "border-emerald-500 bg-emerald-50 text-emerald-700"
											: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
									}`}
								>
									<input
										type="radio"
										name="eventType"
										value={type}
										checked={config.eventType === type}
										onChange={() => onChange({ ...config, eventType: type })}
										className="sr-only"
									/>
									{type === "rehearsal" && "🎭 Rehearsal"}
									{type === "show" && "🎪 Show"}
									{type === "other" && "📋 Other"}
								</label>
							))}
						</div>
					</div>

					<div>
						<label
							htmlFor="event-description"
							className="mb-1.5 block text-sm font-medium text-slate-700"
						>
							Description <span className="font-normal text-slate-400">(optional)</span>
						</label>
						<textarea
							id="event-description"
							value={config.description}
							onChange={(e) => onChange({ ...config, description: e.target.value })}
							rows={2}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							placeholder="Add any notes for the group..."
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="event-start-time"
								className="mb-1.5 block text-sm font-medium text-slate-700"
							>
								<Clock className="mr-1 inline h-4 w-4 text-slate-400" />
								Start Time
							</label>
							<input
								id="event-start-time"
								type="time"
								value={config.startTime}
								onChange={(e) => onChange({ ...config, startTime: e.target.value })}
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
						<div>
							<label
								htmlFor="event-end-time"
								className="mb-1.5 block text-sm font-medium text-slate-700"
							>
								<Clock className="mr-1 inline h-4 w-4 text-slate-400" />
								End Time
							</label>
							<input
								id="event-end-time"
								type="time"
								value={config.endTime}
								onChange={(e) => onChange({ ...config, endTime: e.target.value })}
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Per-Date Locations */}
			<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-slate-900">
						<MapPin className="mr-1.5 inline h-5 w-5 text-slate-400" />
						Locations
					</h2>
				</div>

				<div className="mb-4 flex items-center gap-2">
					<input
						type="text"
						value={applyAllLocation}
						onChange={(e) => setApplyAllLocation(e.target.value)}
						placeholder="Enter a location..."
						className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
					/>
					<button
						type="button"
						onClick={applyToAll}
						disabled={!applyAllLocation.trim()}
						className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Apply to All
					</button>
				</div>

				<div className="space-y-2">
					{selectedDates.map((date) => (
						<div key={date} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
							<div className="w-28 shrink-0">
								<span className="text-sm font-medium text-slate-700">{formatDateShort(date)}</span>
								<span className="ml-1.5 text-xs text-slate-400">{formatDayOfWeek(date)}</span>
							</div>
							<input
								type="text"
								value={config.locations[date] ?? ""}
								onChange={(e) => setLocation(date, e.target.value)}
								placeholder="Location"
								className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>
					))}
				</div>
			</div>

			{/* Navigation */}
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onBack}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					<ArrowLeft className="h-4 w-4" />
					Back
				</button>
				<button
					type="button"
					onClick={onNext}
					disabled={!config.title.trim()}
					className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Review Events
					<ArrowRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}

// ─── Phase 3: Review ─────────────────────────────────────────────────────────

function formatTimeDisplay(time24: string): string {
	const [h, m] = time24.split(":").map(Number);
	const ampm = h >= 12 ? "PM" : "AM";
	const hour12 = h % 12 || 12;
	return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function ReviewPhase({
	selectedDates,
	config,
	onBack,
	onConfirm,
}: {
	selectedDates: string[];
	config: EventConfig;
	onBack: () => void;
	onConfirm: () => void;
}) {
	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="mb-1 text-lg font-semibold text-slate-900">Review Events</h2>
				<p className="mb-6 text-sm text-slate-500">
					Confirm the details before creating {selectedDates.length} events.
				</p>

				{/* Summary bar */}
				<div className="mb-6 flex flex-wrap gap-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
					<span className="flex items-center gap-1.5">
						<Calendar className="h-4 w-4 text-slate-400" />
						{selectedDates.length} events
					</span>
					<span className="flex items-center gap-1.5">
						<Clock className="h-4 w-4 text-slate-400" />
						{formatTimeDisplay(config.startTime)} – {formatTimeDisplay(config.endTime)}
					</span>
					<span className="flex items-center gap-1.5">
						<Users className="h-4 w-4 text-slate-400" />6 members notified
					</span>
					<span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
						{config.eventType === "rehearsal" && "🎭 Rehearsal"}
						{config.eventType === "show" && "🎪 Show"}
						{config.eventType === "other" && "📋 Other"}
					</span>
				</div>

				<div className="space-y-3">
					{selectedDates.map((date) => (
						<div
							key={date}
							className="flex items-center gap-4 rounded-lg border border-slate-100 bg-white px-4 py-3 transition-colors hover:bg-slate-50"
						>
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
								<Calendar className="h-5 w-5" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-slate-900">{config.title}</p>
								<div className="mt-0.5 flex flex-wrap gap-3 text-sm text-slate-500">
									<span className="flex items-center gap-1">
										<Calendar className="h-3.5 w-3.5" />
										{formatDateLong(date)}
									</span>
									<span className="flex items-center gap-1">
										<Clock className="h-3.5 w-3.5" />
										{formatTimeDisplay(config.startTime)} – {formatTimeDisplay(config.endTime)}
									</span>
									{config.locations[date] && (
										<span className="flex items-center gap-1">
											<MapPin className="h-3.5 w-3.5" />
											{config.locations[date]}
										</span>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Notification summary */}
			<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
				<div className="flex items-start gap-3">
					<Send className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
					<div>
						<p className="text-sm font-medium text-emerald-800">One consolidated notification</p>
						<p className="mt-0.5 text-sm text-emerald-600">
							All 6 group members will receive a single email listing all {selectedDates.length} new
							events — no inbox spam.
						</p>
					</div>
				</div>
			</div>

			{/* Navigation */}
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={onBack}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					<ArrowLeft className="h-4 w-4" />
					Back
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md"
				>
					<Sparkles className="h-4 w-4" />
					Create {selectedDates.length} Events & Notify
				</button>
			</div>
		</div>
	);
}

// ─── Phase 4: Success ────────────────────────────────────────────────────────

function SuccessPhase({ count, onRestart }: { count: number; onRestart: () => void }) {
	return (
		<div className="flex flex-col items-center py-12">
			<div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
				<CheckCircle2 className="h-10 w-10 text-emerald-600" />
			</div>
			<h2 className="mb-2 text-2xl font-bold text-slate-900">All Set!</h2>
			<p className="mb-1 text-center text-slate-600">
				Created <span className="font-semibold text-emerald-700">{count}</span> events successfully.
			</p>
			<p className="mb-8 text-center text-sm text-slate-500">
				1 consolidated notification sent to 6 group members.
			</p>

			{/* Simulated event cards */}
			<div className="mb-8 w-full max-w-md space-y-2">
				{Array.from({ length: Math.min(count, 3) }).map((_, i) => (
					<div
						key={`event-created-${i.toString()}`}
						className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-2 text-sm"
					>
						<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
						<span className="text-slate-600">Event {i + 1} created</span>
					</div>
				))}
				{count > 3 && <p className="text-center text-xs text-slate-400">and {count - 3} more...</p>}
			</div>

			<div className="flex gap-3">
				<button
					type="button"
					onClick={onRestart}
					className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
				>
					<RotateCcw className="h-4 w-4" />
					Create More
				</button>
				<button
					type="button"
					onClick={onRestart}
					className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
				>
					<Calendar className="h-4 w-4" />
					View Events
				</button>
			</div>
		</div>
	);
}

// ─── Main Route ──────────────────────────────────────────────────────────────

export default function BatchHeatmapDemo() {
	const [phase, setPhase] = useState<Phase>(1);
	const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
	const [config, setConfig] = useState<EventConfig>({
		title: "Thursday Rehearsal",
		eventType: "rehearsal",
		description: "",
		startTime: "19:00",
		endTime: "21:00",
		locations: {},
	});

	const sortedSelected = useMemo(() => [...selectedDates].sort(), [selectedDates]);

	const toggleDate = useCallback((date: string) => {
		setSelectedDates((prev) => {
			const next = new Set(prev);
			if (next.has(date)) next.delete(date);
			else next.add(date);
			return next;
		});
	}, []);

	const selectTop = useCallback((n: number) => {
		const scores = computeScores(MOCK_DATES);
		const topDates = scores
			.sort((a, b) => b.score - a.score)
			.slice(0, n)
			.map((s) => s.date);
		setSelectedDates(new Set(topDates));
	}, []);

	const goToPhase2 = useCallback(() => {
		// Pre-fill rotating locations for selected dates
		const sorted = [...selectedDates].sort();
		const locs: Record<string, string> = {};
		for (let i = 0; i < sorted.length; i++) {
			locs[sorted[i]] = DEFAULT_LOCATIONS[i % DEFAULT_LOCATIONS.length];
		}
		setConfig((prev) => ({ ...prev, locations: locs }));
		setPhase(2);
	}, [selectedDates]);

	const restart = useCallback(() => {
		setPhase(1);
		setSelectedDates(new Set());
		setConfig({
			title: "Thursday Rehearsal",
			eventType: "rehearsal",
			description: "",
			startTime: "19:00",
			endTime: "21:00",
			locations: {},
		});
	}, []);

	return (
		<div className="mx-auto max-w-5xl px-4 py-8">
			{/* Header */}
			<div className="mb-6 text-center">
				<div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
					<Sparkles className="h-3.5 w-3.5" />
					Prototype
				</div>
				<h1 className="text-2xl font-bold text-slate-900">Multi-Select from Heatmap</h1>
				<p className="mt-1 text-slate-500">
					Select the best dates, configure events in batch, and notify your group.
				</p>
			</div>

			<PhaseIndicator current={phase} />

			{phase === 1 && (
				<HeatmapPhase
					selected={selectedDates}
					onToggle={toggleDate}
					onSelectTop={selectTop}
					onNext={goToPhase2}
				/>
			)}
			{phase === 2 && (
				<ConfigurePhase
					selectedDates={sortedSelected}
					config={config}
					onChange={setConfig}
					onBack={() => setPhase(1)}
					onNext={() => setPhase(3)}
				/>
			)}
			{phase === 3 && (
				<ReviewPhase
					selectedDates={sortedSelected}
					config={config}
					onBack={() => setPhase(2)}
					onConfirm={() => setPhase(4)}
				/>
			)}
			{phase === 4 && <SuccessPhase count={sortedSelected.length} onRestart={restart} />}
		</div>
	);
}
