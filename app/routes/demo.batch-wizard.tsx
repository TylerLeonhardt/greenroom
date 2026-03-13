import { useState, useCallback, useEffect } from "react";
import type { MetaFunction } from "@remix-run/node";
import {
ArrowLeft,
ArrowRight,
Calendar,
Clock,
MapPin,
Check,
CheckCircle,
Plus,
Trash2,
Loader2,
Sparkles,
Mail,
Users,
} from "lucide-react";

export const meta: MetaFunction = () => [
{ title: "Batch Wizard Demo — My Call Time" },
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

const LOCATIONS = ["Main Stage", "Studio B", "Room 204", "The Black Box"];

const EVENT_TYPES = [
{ value: "rehearsal", label: "Rehearsal", emoji: "🎯" },
{ value: "show", label: "Show", emoji: "🎭" },
{ value: "other", label: "Other", emoji: "📅" },
] as const;

const TIMEZONES = [
"America/New_York",
"America/Chicago",
"America/Denver",
"America/Los_Angeles",
"America/Phoenix",
"America/Anchorage",
"Pacific/Honolulu",
"Europe/London",
"Europe/Paris",
"Asia/Tokyo",
];

interface DateRow {
id: string;
date: string;
startTime: string;
endTime: string;
location: string;
}

function formatDate(dateStr: string): string {
const [y, m, d] = dateStr.split("-").map(Number);
const date = new Date(y, m - 1, d);
return date.toLocaleDateString("en-US", {
weekday: "short",
month: "short",
day: "numeric",
year: "numeric",
});
}

function formatDay(dateStr: string): string {
const [y, m, d] = dateStr.split("-").map(Number);
const date = new Date(y, m - 1, d);
return date.toLocaleDateString("en-US", { weekday: "long" });
}

function formatTime12(time24: string): string {
const [h, min] = time24.split(":").map(Number);
const period = h >= 12 ? "PM" : "AM";
const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
return `${hour12}:${min.toString().padStart(2, "0")} ${period}`;
}

function typeBadgeClass(type: string): string {
if (type === "rehearsal") return "bg-emerald-100 text-emerald-700";
if (type === "show") return "bg-purple-100 text-purple-700";
return "bg-slate-100 text-slate-600";
}

function typeEmoji(type: string): string {
if (type === "rehearsal") return "🎯";
if (type === "show") return "��";
return "📅";
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────

const STEP_LABELS = ["Details", "Dates", "Review", "Done"];

function StepIndicator({ current }: { current: number }) {
return (
<div className="mb-8 flex items-center justify-center">
{STEP_LABELS.map((label, i) => {
const stepNum = i + 1;
const isCompleted = stepNum < current;
const isActive = stepNum === current;
return (
<div key={label} className="flex items-center">
{/* circle */}
<div className="flex flex-col items-center">
<div
className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
isCompleted
? "bg-emerald-600 text-white"
: isActive
? "bg-emerald-600 text-white ring-4 ring-emerald-100"
: "bg-slate-200 text-slate-500"
}`}
>
{isCompleted ? <Check className="h-4 w-4" /> : stepNum}
</div>
<span
className={`mt-1.5 text-xs font-medium ${
isActive || isCompleted ? "text-emerald-700" : "text-slate-400"
}`}
>
{label}
</span>
</div>
{/* connector */}
{i < STEP_LABELS.length - 1 && (
<div
className={`mx-2 mb-5 h-0.5 w-12 rounded transition-colors duration-300 sm:w-16 ${
stepNum < current ? "bg-emerald-500" : "bg-slate-200"
}`}
/>
)}
</div>
);
})}
</div>
);
}

// ─── Step 1: Shared Details ────────────────────────────────────────────────────

function StepDetails({
title,
setTitle,
eventType,
setEventType,
description,
setDescription,
startTime,
setStartTime,
endTime,
setEndTime,
location,
setLocation,
timezone,
setTimezone,
onNext,
}: {
title: string;
setTitle: (v: string) => void;
eventType: string;
setEventType: (v: string) => void;
description: string;
setDescription: (v: string) => void;
startTime: string;
setStartTime: (v: string) => void;
endTime: string;
setEndTime: (v: string) => void;
location: string;
setLocation: (v: string) => void;
timezone: string;
setTimezone: (v: string) => void;
onNext: () => void;
}) {
return (
<div className="space-y-6">
<div>
<h2 className="text-2xl font-bold text-slate-900">Shared Event Details</h2>
<p className="mt-1 text-sm text-slate-500">
These defaults apply to every event in the batch. You can override per-date in the
next step.
</p>
</div>

<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<div className="grid gap-5 sm:grid-cols-2">
{/* Title */}
<div className="sm:col-span-2">
<label className="mb-1.5 block text-sm font-medium text-slate-700">
Event Title <span className="text-red-500">*</span>
</label>
<input
type="text"
value={title}
onChange={(e) => setTitle(e.target.value)}
placeholder="e.g. Thursday Rehearsal"
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
/>
</div>

{/* Event Type */}
<div className="sm:col-span-2">
<label className="mb-1.5 block text-sm font-medium text-slate-700">
Event Type
</label>
<div className="flex flex-wrap gap-3">
{EVENT_TYPES.map((t) => (
<button
key={t.value}
type="button"
onClick={() => setEventType(t.value)}
className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
eventType === t.value
? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20"
: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
}`}
>
<span className="text-base">{t.emoji}</span>
{t.label}
</button>
))}
</div>
</div>

{/* Description */}
<div className="sm:col-span-2">
<label className="mb-1.5 block text-sm font-medium text-slate-700">
Description{" "}
<span className="font-normal text-slate-400">(optional)</span>
</label>
<textarea
value={description}
onChange={(e) => setDescription(e.target.value)}
rows={2}
placeholder="Add a note for all events..."
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
/>
</div>

{/* Start Time */}
<div>
<label className="mb-1.5 block text-sm font-medium text-slate-700">
Default Start Time
</label>
<div className="relative">
<Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
<input
type="time"
value={startTime}
onChange={(e) => setStartTime(e.target.value)}
className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
/>
</div>
</div>

{/* End Time */}
<div>
<label className="mb-1.5 block text-sm font-medium text-slate-700">
Default End Time
</label>
<div className="relative">
<Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
<input
type="time"
value={endTime}
onChange={(e) => setEndTime(e.target.value)}
className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
/>
</div>
</div>

{/* Location */}
<div>
<label className="mb-1.5 block text-sm font-medium text-slate-700">
Default Location
</label>
<div className="relative">
<MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
<input
type="text"
value={location}
onChange={(e) => setLocation(e.target.value)}
placeholder="e.g. Main Stage"
className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
/>
</div>
</div>

{/* Timezone */}
<div>
<label className="mb-1.5 block text-sm font-medium text-slate-700">
Timezone
</label>
<select
value={timezone}
onChange={(e) => setTimezone(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
>
{TIMEZONES.map((tz) => (
<option key={tz} value={tz}>
{tz.replace(/_/g, " ")}
</option>
))}
</select>
</div>
</div>
</div>

{/* Navigation */}
<div className="flex justify-end">
<button
type="button"
disabled={!title.trim()}
onClick={onNext}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
>
Next <ArrowRight className="h-4 w-4" />
</button>
</div>
</div>
);
}

// ─── Step 2: Select & Configure Dates ──────────────────────────────────────────

function StepDates({
rows,
setRows,
onBack,
onNext,
}: {
rows: DateRow[];
setRows: (r: DateRow[]) => void;
onBack: () => void;
onNext: () => void;
}) {
const updateRow = useCallback(
(id: string, field: keyof DateRow, value: string) => {
setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
},
[rows, setRows],
);

const deleteRow = useCallback(
(id: string) => {
setRows(rows.filter((r) => r.id !== id));
},
[rows, setRows],
);

const addRow = useCallback(() => {
const lastDate = rows.length > 0 ? rows[rows.length - 1].date : "2026-06-18";
const d = new Date(lastDate);
d.setDate(d.getDate() + 7);
const iso = d.toISOString().slice(0, 10);
setRows([
...rows,
{
id: crypto.randomUUID(),
date: iso,
startTime: rows[0]?.startTime ?? "19:00",
endTime: rows[0]?.endTime ?? "21:00",
location: LOCATIONS[rows.length % LOCATIONS.length],
},
]);
}, [rows, setRows]);

return (
<div className="space-y-6">
<div>
<h2 className="text-2xl font-bold text-slate-900">Select & Configure Dates</h2>
<p className="mt-1 text-sm text-slate-500">
{rows.length} date{rows.length !== 1 ? "s" : ""} selected. Override times or
locations per date.
</p>
</div>

{/* Tip */}
<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
<Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
<p className="text-sm text-amber-800">
<span className="font-medium">Tip:</span> In the full version, import dates
directly from availability results — members who said "available" are
pre-selected.
</p>
</div>

{/* Table */}
<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
<table className="w-full text-sm">
<thead>
<tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
<th className="px-4 py-3">#</th>
<th className="px-4 py-3">Date</th>
<th className="hidden px-4 py-3 sm:table-cell">Day</th>
<th className="px-4 py-3">Start</th>
<th className="px-4 py-3">End</th>
<th className="px-4 py-3">Location</th>
<th className="px-4 py-3" />
</tr>
</thead>
<tbody>
{rows.map((row, i) => (
<tr
key={row.id}
className="border-b border-slate-50 transition-colors hover:bg-slate-50/50"
>
<td className="px-4 py-2.5 font-medium text-slate-400">
{i + 1}
</td>
<td className="px-4 py-2.5">
<input
type="date"
value={row.date}
onChange={(e) =>
updateRow(row.id, "date", e.target.value)
}
className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
/>
</td>
<td className="hidden px-4 py-2.5 text-slate-500 sm:table-cell">
{formatDay(row.date)}
</td>
<td className="px-4 py-2.5">
<input
type="time"
value={row.startTime}
onChange={(e) =>
updateRow(row.id, "startTime", e.target.value)
}
className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
/>
</td>
<td className="px-4 py-2.5">
<input
type="time"
value={row.endTime}
onChange={(e) =>
updateRow(row.id, "endTime", e.target.value)
}
className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
/>
</td>
<td className="px-4 py-2.5">
<input
type="text"
value={row.location}
onChange={(e) =>
updateRow(row.id, "location", e.target.value)
}
className="w-full min-w-[120px] rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
/>
</td>
<td className="px-4 py-2.5">
<button
type="button"
onClick={() => deleteRow(row.id)}
disabled={rows.length <= 1}
className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
title="Remove date"
>
<Trash2 className="h-4 w-4" />
</button>
</td>
</tr>
))}
</tbody>
</table>
</div>

{/* Add Date */}
<button
type="button"
onClick={addRow}
className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
>
<Plus className="h-4 w-4" /> Add Date
</button>

{/* Navigation */}
<div className="flex justify-between">
<button
type="button"
onClick={onBack}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
>
<ArrowLeft className="h-4 w-4" /> Back
</button>
<button
type="button"
disabled={rows.length === 0}
onClick={onNext}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
>
Next <ArrowRight className="h-4 w-4" />
</button>
</div>
</div>
);
}

// ─── Step 3: Review ────────────────────────────────────────────────────────────

function StepReview({
title,
eventType,
rows,
creating,
onBack,
onCreate,
}: {
title: string;
eventType: string;
rows: DateRow[];
creating: boolean;
onBack: () => void;
onCreate: () => void;
}) {
return (
<div className="space-y-6">
<div>
<h2 className="text-2xl font-bold text-slate-900">Review All Events</h2>
<p className="mt-1 text-sm text-slate-500">
Double-check everything before creating.
</p>
</div>

{/* Summary */}
<div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
<div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
<Calendar className="h-5 w-5 text-emerald-600" />
</div>
<div className="flex-1">
<p className="text-base font-semibold text-slate-900">
Ready to create{" "}
<span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-bold text-emerald-700">
{rows.length}
</span>{" "}
events
</p>
<p className="text-sm text-slate-500">
"{title}" — {eventType} events
</p>
</div>
</div>

{/* Notification info */}
<div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
<Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
<p className="text-sm text-blue-800">
<span className="font-medium">One consolidated notification email</span> will be
sent to all group members — not one per event.
</p>
</div>

{/* Event Cards */}
<div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4">
{rows.map((row, i) => (
<div
key={row.id}
className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md"
>
<span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
{i + 1}
</span>
<div className="min-w-0 flex-1">
<div className="flex flex-wrap items-center gap-2">
<span className="font-medium text-slate-900">{title}</span>
<span
className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(eventType)}`}
>
{typeEmoji(eventType)} {eventType}
</span>
</div>
<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
<span className="inline-flex items-center gap-1">
<Calendar className="h-3 w-3" />
{formatDate(row.date)}
</span>
<span className="inline-flex items-center gap-1">
<Clock className="h-3 w-3" />
{formatTime12(row.startTime)} – {formatTime12(row.endTime)}
</span>
<span className="inline-flex items-center gap-1">
<MapPin className="h-3 w-3" />
{row.location}
</span>
</div>
</div>
</div>
))}
</div>

{/* Navigation */}
<div className="flex justify-between">
<button
type="button"
onClick={onBack}
disabled={creating}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
>
<ArrowLeft className="h-4 w-4" /> Back
</button>
<button
type="button"
onClick={onCreate}
disabled={creating}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
>
{creating ? (
<>
<Loader2 className="h-4 w-4 animate-spin" /> Creating...
</>
) : (
<>
<Sparkles className="h-4 w-4" /> Create {rows.length} Events
</>
)}
</button>
</div>
</div>
);
}

// ─── Step 4: Success ───────────────────────────────────────────────────────────

function StepSuccess({
count,
onReset,
}: {
count: number;
onReset: () => void;
}) {
const [visible, setVisible] = useState(false);

useEffect(() => {
const t = setTimeout(() => setVisible(true), 100);
return () => clearTimeout(t);
}, []);

return (
<div className="flex flex-col items-center py-8 text-center">
{/* Animated check */}
<div
className={`flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 transition-all duration-500 ${
visible ? "scale-100 opacity-100" : "scale-50 opacity-0"
}`}
>
<CheckCircle className="h-10 w-10 text-emerald-600" />
</div>

<h2
className={`mt-6 text-2xl font-bold text-slate-900 transition-all delay-200 duration-500 ${
visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
}`}
>
All Set!
</h2>

<p
className={`mt-2 text-lg text-slate-600 transition-all delay-300 duration-500 ${
visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
}`}
>
Successfully created{" "}
<span className="font-bold text-emerald-600">{count} events</span>
</p>

<div
className={`mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 transition-all delay-[400ms] duration-500 ${
visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
}`}
>
<Mail className="h-4 w-4 text-blue-500" />
<span>
<span className="font-semibold">1</span> consolidated notification email sent to{" "}
<span className="font-semibold">6</span> group members
</span>
</div>

<div
className={`mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 transition-all delay-500 duration-500 ${
visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
}`}
>
<Users className="h-4 w-4 text-emerald-500" />
<span>All group members can now see these events on their dashboard</span>
</div>

{/* Buttons */}
<div
className={`mt-8 flex gap-3 transition-all delay-[600ms] duration-500 ${
visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
}`}
>
<button
type="button"
onClick={() => {}}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
>
<Calendar className="h-4 w-4" /> View Events
</button>
<button
type="button"
onClick={onReset}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
>
<Plus className="h-4 w-4" /> Create More
</button>
</div>
</div>
);
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function DemoBatchWizard() {
const [step, setStep] = useState(1);
const [creating, setCreating] = useState(false);

// Step 1 state
const [title, setTitle] = useState("Thursday Rehearsal");
const [eventType, setEventType] = useState("rehearsal");
const [description, setDescription] = useState("");
const [startTime, setStartTime] = useState("19:00");
const [endTime, setEndTime] = useState("21:00");
const [location, setLocation] = useState("Main Stage");
const [timezone, setTimezone] = useState("America/Los_Angeles");

// Step 2 state
const [rows, setRows] = useState<DateRow[]>(() =>
MOCK_DATES.map((date, i) => ({
id: crypto.randomUUID(),
date,
startTime: "19:00",
endTime: "21:00",
location: LOCATIONS[i % LOCATIONS.length],
})),
);

const eventCount = rows.length;

const handleCreate = useCallback(() => {
setCreating(true);
setTimeout(() => {
setCreating(false);
setStep(4);
}, 800);
}, []);

const handleReset = useCallback(() => {
setStep(1);
setTitle("Thursday Rehearsal");
setEventType("rehearsal");
setDescription("");
setStartTime("19:00");
setEndTime("21:00");
setLocation("Main Stage");
setTimezone("America/Los_Angeles");
setRows(
MOCK_DATES.map((date, i) => ({
id: crypto.randomUUID(),
date,
startTime: "19:00",
endTime: "21:00",
location: LOCATIONS[i % LOCATIONS.length],
})),
);
}, []);

return (
<div className="min-h-screen bg-slate-50">
{/* Header */}
<header className="border-b border-slate-200 bg-white">
<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
<div>
<h1 className="text-lg font-bold text-slate-900">Batch Create Events</h1>
<p className="text-sm text-slate-500">Create multiple events at once</p>
</div>
<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
PROTOTYPE
</span>
</div>
</header>

{/* Content */}
<main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
<StepIndicator current={step} />

{step === 1 && (
<StepDetails
title={title}
setTitle={setTitle}
eventType={eventType}
setEventType={setEventType}
description={description}
setDescription={setDescription}
startTime={startTime}
setStartTime={setStartTime}
endTime={endTime}
setEndTime={setEndTime}
location={location}
setLocation={setLocation}
timezone={timezone}
setTimezone={setTimezone}
onNext={() => setStep(2)}
/>
)}

{step === 2 && (
<StepDates
rows={rows}
setRows={setRows}
onBack={() => setStep(1)}
onNext={() => setStep(3)}
/>
)}

{step === 3 && (
<StepReview
title={title}
eventType={eventType}
rows={rows}
creating={creating}
onBack={() => setStep(2)}
onCreate={handleCreate}
/>
)}

{step === 4 && <StepSuccess count={eventCount} onReset={handleReset} />}
</main>
</div>
);
}
