import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
ArrowLeft,
ArrowRight,
Calendar,
Check,
CheckCircle2,
ChevronDown,
ChevronRight,
Clock,
MapPin,
Star,
Trash2,
Users,
X,
} from "lucide-react";
import { Fragment, useState } from "react";

export const meta: MetaFunction = () => {
return [{ title: "Batch Event Creation — My Call Time" }];
};

// ─── Mock Data ─────────────────────────────────────────────────────────────

const MOCK_GROUP_ID = "mock-group-1";
const MOCK_REQUEST_ID = "mock-request-1";
const MOCK_GROUP_NAME = "Chicago Improv Collective";

const MOCK_DATES = [
"2026-03-19",
"2026-03-26",
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
];

const MOCK_MEMBERS = [
{ name: "Sarah Chen", status: "available" },
{ name: "Marcus Johnson", status: "available" },
{ name: "Priya Patel", status: "available" },
{ name: "James Wilson", status: "maybe" },
{ name: "Emma Rodriguez", status: "available" },
{ name: "David Kim", status: "not_available" },
{ name: "Lisa Thompson", status: "available" },
{ name: "Alex Rivera", status: "maybe" },
];

const MOCK_LOCATIONS = [
"iO Theater - 1501 N Kingsbury St",
"Second City Training Center - 230 W North Ave",
"Annoyance Theatre - 851 W Belmont Ave",
"CIC Theater - 4049 W Lawrence Ave",
];

type MemberStatus = "available" | "maybe" | "not_available";

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

// Generate realistic per-date availability
function generateMockResults(): DateResult[] {
// Define score tiers for realism
const bestDates = new Set(["2026-03-19", "2026-04-02", "2026-04-16", "2026-05-07", "2026-05-21"]);
const worstDates = new Set(["2026-04-30", "2026-05-28"]);

return MOCK_DATES.map((date) => {
let respondents: Array<{ name: string; status: MemberStatus }>;

if (bestDates.has(date)) {
// Best dates: 6 available, 1 maybe, 1 not available → score 13
respondents = [
{ name: "Sarah Chen", status: "available" },
{ name: "Marcus Johnson", status: "available" },
{ name: "Priya Patel", status: "available" },
{ name: "James Wilson", status: "maybe" },
{ name: "Emma Rodriguez", status: "available" },
{ name: "David Kim", status: "available" },
{ name: "Lisa Thompson", status: "available" },
{ name: "Alex Rivera", status: "not_available" },
];
} else if (worstDates.has(date)) {
// Worst dates: 2 available, 1 maybe, 5 not available → score 5
respondents = [
{ name: "Sarah Chen", status: "available" },
{ name: "Marcus Johnson", status: "not_available" },
{ name: "Priya Patel", status: "not_available" },
{ name: "James Wilson", status: "maybe" },
{ name: "Emma Rodriguez", status: "not_available" },
{ name: "David Kim", status: "not_available" },
{ name: "Lisa Thompson", status: "available" },
{ name: "Alex Rivera", status: "not_available" },
];
} else {
// Medium dates: 4 available, 2 maybe, 2 not available → score 10
respondents = [
{ name: "Sarah Chen", status: "available" },
{ name: "Marcus Johnson", status: "available" },
{ name: "Priya Patel", status: "maybe" },
{ name: "James Wilson", status: "maybe" },
{ name: "Emma Rodriguez", status: "available" },
{ name: "David Kim", status: "not_available" },
{ name: "Lisa Thompson", status: "available" },
{ name: "Alex Rivera", status: "not_available" },
];
}

const available = respondents.filter((r) => r.status === "available").length;
const maybe = respondents.filter((r) => r.status === "maybe").length;
const notAvailable = respondents.filter((r) => r.status === "not_available").length;

return {
date,
available,
maybe,
notAvailable,
noResponse: 0,
total: 8,
score: available * 2 + maybe,
respondents,
};
});
}

const MOCK_RESULTS = generateMockResults();
const MAX_SCORE = Math.max(...MOCK_RESULTS.map((d) => d.score), 1);
const TOP_DATES = [...MOCK_RESULTS]
.sort((a, b) => b.score - a.score)
.slice(0, 3)
.map((d) => d.date);
const TOP_DATE_SET = new Set(TOP_DATES);

// ─── Helpers ───────────────────────────────────────────────────────────────

function getHeatColor(score: number, maxScore: number): string {
if (maxScore === 0) return "bg-slate-50";
const ratio = score / maxScore;
if (ratio >= 0.8) return "bg-emerald-100";
if (ratio >= 0.6) return "bg-emerald-50";
if (ratio >= 0.4) return "bg-amber-50";
if (ratio >= 0.2) return "bg-rose-50";
return "bg-rose-100";
}

function formatDateDisplay(dateStr: string): { dayOfWeek: string; display: string } {
const date = new Date(`${dateStr}T12:00:00Z`);
return {
dayOfWeek: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
display: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
};
}

function formatDateFull(dateStr: string): string {
const date = new Date(`${dateStr}T12:00:00Z`);
return date.toLocaleDateString("en-US", {
weekday: "long",
month: "long",
day: "numeric",
year: "numeric",
timeZone: "UTC",
});
}

function formatTime12(time24: string): string {
const [h, m] = time24.split(":").map(Number);
const period = h >= 12 ? "PM" : "AM";
const hour12 = h % 12 || 12;
return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

type Step = "select" | "configure" | "review" | "success";
type EventType = "rehearsal" | "show" | "other";

const statusIcon: Record<string, React.ReactNode> = {
available: <Check className="inline h-3.5 w-3.5 text-emerald-600" />,
maybe: <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-xs text-amber-500">?</span>,
not_available: <X className="inline h-3.5 w-3.5 text-rose-600" />,
};

// ─── Route Component ───────────────────────────────────────────────────────

export default function BatchEventCreation() {
const [step, setStep] = useState<Step>("select");
const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
const [expandedDate, setExpandedDate] = useState<string | null>(null);
const [sortBy, setSortBy] = useState<"date" | "score">("date");

// Configuration state
const [title, setTitle] = useState("Thursday Rehearsal");
const [eventType, setEventType] = useState<EventType>("rehearsal");
const [startTime, setStartTime] = useState("19:00");
const [endTime, setEndTime] = useState("21:00");
const [defaultLocation, setDefaultLocation] = useState(MOCK_LOCATIONS[0]);
const [locationOverrides, setLocationOverrides] = useState<Record<string, string>>({});
const [expandedOverrides, setExpandedOverrides] = useState(false);

const sortedDates =
sortBy === "score"
? [...MOCK_RESULTS].sort((a, b) => b.score - a.score)
: MOCK_RESULTS;

const selectedCount = selectedDates.size;

function toggleDate(date: string) {
setSelectedDates((prev) => {
const next = new Set(prev);
if (next.has(date)) {
next.delete(date);
} else {
next.add(date);
}
return next;
});
}

function selectAllBest() {
setSelectedDates((prev) => {
const next = new Set(prev);
for (const d of TOP_DATES) {
next.add(d);
}
return next;
});
}

function selectAll() {
setSelectedDates(new Set(MOCK_DATES));
}

function clearAll() {
setSelectedDates(new Set());
}

function removeDate(date: string) {
setSelectedDates((prev) => {
const next = new Set(prev);
next.delete(date);
return next;
});
setLocationOverrides((prev) => {
const next = { ...prev };
delete next[date];
return next;
});
}

function getLocationForDate(date: string): string {
return locationOverrides[date] || defaultLocation;
}

// Sort selected dates chronologically for display
const selectedDatesSorted = [...selectedDates].sort();

return (
<div className="min-h-screen bg-slate-50">
<div className="mx-auto max-w-4xl px-4 py-8">
{/* Header */}
<div className="mb-8">
<Link
to={`/groups/${MOCK_GROUP_ID}/availability/${MOCK_REQUEST_ID}`}
className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
>
<ArrowLeft className="h-4 w-4" />
Back to Availability Results
</Link>
<h1 className="text-2xl font-bold text-slate-900">Batch Event Creation</h1>
<p className="mt-1 text-sm text-slate-600">
Select dates from availability results to create multiple events at once
</p>
<div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
<div className="flex items-center gap-2 text-sm text-emerald-800">
<Calendar className="h-4 w-4 flex-shrink-0" />
<span>
Creating from:{" "}
<span className="font-semibold">
Thursday Rehearsal Availability (March – May 2026)
</span>
</span>
</div>
</div>
</div>

{/* Step indicator */}
<div className="mb-8">
<div className="flex items-center gap-2">
{(
[
{ key: "select", label: "Select Dates", num: 1 },
{ key: "configure", label: "Configure", num: 2 },
{ key: "review", label: "Review", num: 3 },
] as const
).map(({ key, label, num }, i) => (
<Fragment key={key}>
{i > 0 && (
<div
className={`h-px flex-1 ${
step === key || (step === "review" && num <= 3) || (step === "configure" && num <= 2) || step === "success"
? "bg-emerald-300"
: "bg-slate-200"
}`}
/>
)}
<button
type="button"
onClick={() => {
if (key === "select") setStep("select");
else if (key === "configure" && selectedCount > 0) setStep("configure");
else if (key === "review" && selectedCount > 0) setStep("review");
}}
className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
step === key || (step === "success" && key === "review")
? "bg-emerald-600 text-white"
: step === "configure" && num < 2
? "bg-emerald-100 text-emerald-700"
: step === "review" && num < 3
? "bg-emerald-100 text-emerald-700"
: step === "success"
? "bg-emerald-100 text-emerald-700"
: "bg-slate-100 text-slate-500"
}`}
>
{((step === "configure" && num < 2) ||
(step === "review" && num < 3) ||
step === "success") ? (
<CheckCircle2 className="h-3.5 w-3.5" />
) : (
<span>{num}</span>
)}
{label}
</button>
</Fragment>
))}
</div>
</div>

{/* Success State */}
{step === "success" && (
<div className="rounded-xl border border-emerald-200 bg-white p-12 text-center shadow-sm">
<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
<CheckCircle2 className="h-10 w-10 text-emerald-600" />
</div>
<h2 className="text-2xl font-bold text-slate-900">
{selectedCount} Events Created Successfully!
</h2>
<p className="mt-3 text-slate-600">
One consolidated notification sent to {MOCK_MEMBERS.length} members
</p>
<div className="mt-8 flex items-center justify-center gap-4">
<Link
to={`/groups/${MOCK_GROUP_ID}/events`}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white hover:bg-emerald-700"
>
View Events
<ArrowRight className="h-4 w-4" />
</Link>
<Link
to={`/groups/${MOCK_GROUP_ID}/availability/${MOCK_REQUEST_ID}`}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
>
Back to Availability Results
</Link>
</div>
</div>
)}

{/* Step 1: Date Selection */}
{step === "select" && (
<div className="space-y-4">
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<div className="mb-4 flex flex-wrap items-center justify-between gap-4">
<div>
<h2 className="text-lg font-semibold text-slate-900">
Select Dates
</h2>
<p className="text-sm text-slate-500">
Choose dates to create events for
</p>
</div>
<div className="flex items-center gap-4 text-sm">
<span className="text-slate-600">
<span className="font-semibold text-slate-900">8</span>/8 responded
</span>
<div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
<div
className="h-full rounded-full bg-emerald-500"
style={{ width: "100%" }}
/>
</div>
</div>
</div>

{/* Action bar */}
<div className="mb-4 flex flex-wrap items-center gap-2">
<button
type="button"
onClick={selectAllBest}
className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
>
<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
Select Best Dates
</button>
<button
type="button"
onClick={selectAll}
className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
>
Select All
</button>
{selectedCount > 0 && (
<button
type="button"
onClick={clearAll}
className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
>
Clear Selection
</button>
)}
<div className="ml-auto flex items-center gap-2">
<span className="text-xs text-slate-500">Sort by:</span>
<button
type="button"
onClick={() => setSortBy("date")}
className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
sortBy === "date"
? "bg-slate-900 text-white"
: "text-slate-600 hover:bg-slate-100"
}`}
>
Date
</button>
<button
type="button"
onClick={() => setSortBy("score")}
className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
sortBy === "score"
? "bg-slate-900 text-white"
: "text-slate-600 hover:bg-slate-100"
}`}
>
Best First
</button>
</div>
</div>

{/* Heatmap table */}
<div className="overflow-hidden rounded-xl border border-slate-200">
<table className="w-full">
<thead>
<tr className="bg-slate-50">
<th className="w-10 px-3 py-3">
<input
type="checkbox"
checked={selectedCount === MOCK_DATES.length}
onChange={() => {
if (selectedCount === MOCK_DATES.length) {
clearAll();
} else {
selectAll();
}
}}
className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
/>
</th>
<th className="w-8 px-2 py-3" />
<th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
Date
</th>
<th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
Day
</th>
<th className="px-3 py-3 text-center text-xs font-medium text-emerald-600">
✅
</th>
<th className="px-3 py-3 text-center text-xs font-medium text-amber-500">
🤔
</th>
<th className="px-3 py-3 text-center text-xs font-medium text-rose-600">
❌
</th>
<th className="px-4 py-3 text-center text-xs font-medium text-slate-500">
Score
</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100">
{sortedDates.map((row) => {
const { dayOfWeek, display } = formatDateDisplay(row.date);
const isExpanded = expandedDate === row.date;
const isBest = TOP_DATE_SET.has(row.date);
const isSelected = selectedDates.has(row.date);

return (
<Fragment key={row.date}>
<tr
className={`cursor-pointer transition-colors ${
isSelected
? "bg-emerald-50 ring-1 ring-inset ring-emerald-200"
: getHeatColor(row.score, MAX_SCORE)
} hover:bg-slate-100/50`}
onClick={() => toggleDate(row.date)}
>
<td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
<input
type="checkbox"
checked={isSelected}
onChange={() => toggleDate(row.date)}
className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
/>
</td>
<td
className="px-2 py-3 text-center"
onClick={(e) => {
e.stopPropagation();
setExpandedDate(isExpanded ? null : row.date);
}}
>
{isExpanded ? (
<ChevronDown className="inline h-4 w-4 text-slate-400" />
) : (
<ChevronRight className="inline h-4 w-4 text-slate-400" />
)}
</td>
<td className="px-4 py-3">
<div className="flex items-center gap-2">
<span className="text-sm font-medium text-slate-900">
{display}
</span>
{isBest && (
<Star className="h-4 w-4 fill-amber-400 text-amber-400" />
)}
</div>
</td>
<td className="px-4 py-3 text-sm text-slate-500">
{dayOfWeek}
</td>
<td className="px-3 py-3 text-center text-sm font-medium text-emerald-700">
{row.available}
</td>
<td className="px-3 py-3 text-center text-sm font-medium text-amber-600">
{row.maybe}
</td>
<td className="px-3 py-3 text-center text-sm font-medium text-rose-600">
{row.notAvailable}
</td>
<td className="px-4 py-3 text-center">
<span className="inline-flex items-center rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-semibold text-slate-700">
{row.score}
</span>
</td>
</tr>
{isExpanded && (
<tr>
<td colSpan={8} className="bg-slate-50 px-8 py-4">
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
{row.respondents.map((r) => (
<div
key={r.name}
className="flex items-center gap-2 text-sm"
>
{statusIcon[r.status]}
<span className="text-slate-700">{r.name}</span>
<span className="text-xs text-slate-400">
{r.status === "available"
? "Available"
: r.status === "maybe"
? "Maybe"
: "Unavailable"}
</span>
</div>
))}
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

{/* Sticky bottom bar */}
{selectedCount > 0 && (
<div className="sticky bottom-4 z-10">
<div className="rounded-xl border border-emerald-200 bg-white px-6 py-4 shadow-lg">
<div className="flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
{selectedCount}
</div>
<span className="text-sm font-medium text-slate-700">
{selectedCount === 1 ? "date" : "dates"} selected
</span>
</div>
<button
type="button"
onClick={() => setStep("configure")}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white hover:bg-emerald-700"
>
Continue to Configuration
<ArrowRight className="h-4 w-4" />
</button>
</div>
</div>
</div>
)}
</div>
)}

{/* Step 2: Configuration */}
{step === "configure" && (
<div className="space-y-6">
{/* Shared settings */}
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<h2 className="mb-1 text-lg font-semibold text-slate-900">
Event Configuration
</h2>
<p className="mb-6 text-sm text-slate-500">
These settings apply to all {selectedCount} events
</p>

<div className="space-y-5">
{/* Title */}
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
value={title}
onChange={(e) => setTitle(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
placeholder="e.g., Thursday Rehearsal"
/>
</div>

{/* Event type */}
<div>
<label className="mb-1.5 block text-sm font-medium text-slate-700">
Event Type
</label>
<div className="flex gap-3">
{(
[
{ value: "rehearsal", label: "Rehearsal" },
{ value: "show", label: "Show" },
{ value: "other", label: "Other" },
] as const
).map(({ value, label }) => (
<button
key={value}
type="button"
onClick={() => setEventType(value)}
className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
eventType === value
? "border-emerald-600 bg-emerald-50 text-emerald-700"
: "border-slate-300 text-slate-700 hover:bg-slate-50"
}`}
>
{label}
</button>
))}
</div>
</div>

{/* Time */}
<div className="grid grid-cols-2 gap-4">
<div>
<label
htmlFor="start-time"
className="mb-1.5 block text-sm font-medium text-slate-700"
>
<Clock className="mr-1 inline h-3.5 w-3.5" />
Start Time
</label>
<input
id="start-time"
type="time"
value={startTime}
onChange={(e) => setStartTime(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>
<div>
<label
htmlFor="end-time"
className="mb-1.5 block text-sm font-medium text-slate-700"
>
<Clock className="mr-1 inline h-3.5 w-3.5" />
End Time
</label>
<input
id="end-time"
type="time"
value={endTime}
onChange={(e) => setEndTime(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>
</div>

{/* Default location */}
<div>
<label
htmlFor="default-location"
className="mb-1.5 block text-sm font-medium text-slate-700"
>
<MapPin className="mr-1 inline h-3.5 w-3.5" />
Default Location
</label>
<input
id="default-location"
type="text"
value={defaultLocation}
onChange={(e) => setDefaultLocation(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
placeholder="Venue name and address"
/>
</div>
</div>
</div>

{/* Per-date location overrides */}
<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
<button
type="button"
onClick={() => setExpandedOverrides(!expandedOverrides)}
className="flex w-full items-center justify-between p-6"
>
<div>
<h3 className="text-sm font-semibold text-slate-900">
Per-Date Location Overrides
</h3>
<p className="mt-0.5 text-xs text-slate-500">
Optionally set a different location for specific dates
</p>
</div>
{expandedOverrides ? (
<ChevronDown className="h-5 w-5 text-slate-400" />
) : (
<ChevronRight className="h-5 w-5 text-slate-400" />
)}
</button>
{expandedOverrides && (
<div className="border-t border-slate-200 p-6 pt-4">
<div className="space-y-3">
{selectedDatesSorted.map((date) => {
const { dayOfWeek, display } = formatDateDisplay(date);
const hasOverride = date in locationOverrides;
return (
<div key={date} className="flex items-center gap-3">
<div className="w-28 flex-shrink-0">
<span className="text-sm font-medium text-slate-900">
{display}
</span>
<span className="ml-1.5 text-xs text-slate-500">
{dayOfWeek}
</span>
</div>
{hasOverride ? (
<div className="flex flex-1 items-center gap-2">
<input
type="text"
value={locationOverrides[date]}
onChange={(e) =>
setLocationOverrides((prev) => ({
...prev,
[date]: e.target.value,
}))
}
className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
<button
type="button"
onClick={() =>
setLocationOverrides((prev) => {
const next = { ...prev };
delete next[date];
return next;
})
}
className="text-xs text-slate-500 hover:text-slate-700"
>
Reset
</button>
</div>
) : (
<button
type="button"
onClick={() =>
setLocationOverrides((prev) => ({
...prev,
[date]: defaultLocation,
}))
}
className="text-xs text-slate-400 hover:text-emerald-600"
>
Using default —{" "}
<span className="underline">click to override</span>
</button>
)}
</div>
);
})}
</div>
</div>
)}
</div>

{/* Navigation */}
<div className="flex items-center justify-between">
<button
type="button"
onClick={() => setStep("select")}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
>
<ArrowLeft className="h-4 w-4" />
Back to Date Selection
</button>
<button
type="button"
onClick={() => setStep("review")}
disabled={!title.trim()}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
>
Review {selectedCount} Events
<ArrowRight className="h-4 w-4" />
</button>
</div>
</div>
)}

{/* Step 3: Review */}
{step === "review" && (
<div className="space-y-6">
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<h2 className="mb-1 text-lg font-semibold text-slate-900">
Review {selectedCount} Events
</h2>
<p className="mb-6 text-sm text-slate-500">
Confirm the events below before creating them
</p>

<div className="space-y-3">
{selectedDatesSorted.map((date) => {
const fullDate = formatDateFull(date);
const location = getLocationForDate(date);
const isOverridden = date in locationOverrides;

return (
<div
key={date}
className="flex items-start justify-between rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
>
<div className="space-y-1.5">
<div className="flex items-center gap-2">
<Calendar className="h-4 w-4 text-slate-400" />
<span className="text-sm font-medium text-slate-900">
{fullDate}
</span>
{TOP_DATE_SET.has(date) && (
<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
)}
</div>
<div className="flex items-center gap-4 pl-6 text-xs text-slate-500">
<span className="flex items-center gap-1">
<Clock className="h-3 w-3" />
{formatTime12(startTime)} – {formatTime12(endTime)}
</span>
<span className="flex items-center gap-1">
<MapPin className="h-3 w-3" />
{location}
{isOverridden && (
<span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
custom
</span>
)}
</span>
</div>
<div className="pl-6 text-xs text-slate-400">
{title} · {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
</div>
</div>
<button
type="button"
onClick={() => removeDate(date)}
className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
title="Remove this event"
>
<Trash2 className="h-4 w-4" />
</button>
</div>
);
})}
</div>
</div>

{/* Summary */}
<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
<div className="flex items-start gap-3">
<Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
<div>
<p className="text-sm font-medium text-emerald-900">
{selectedCount} events will be created
</p>
<p className="mt-1 text-sm text-emerald-700">
One notification email will be sent to all {MOCK_MEMBERS.length} group
members in {MOCK_GROUP_NAME}.
</p>
</div>
</div>
</div>

{/* Navigation */}
<div className="flex items-center justify-between">
<button
type="button"
onClick={() => setStep("configure")}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
>
<ArrowLeft className="h-4 w-4" />
Back to Edit
</button>
<button
type="button"
onClick={() => setStep("success")}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white hover:bg-emerald-700"
>
<CheckCircle2 className="h-4 w-4" />
Create All Events & Notify
</button>
</div>
</div>
)}
</div>
</div>
);
}
