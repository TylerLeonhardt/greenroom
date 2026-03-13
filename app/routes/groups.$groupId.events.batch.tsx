import type { MetaFunction } from "@remix-run/node";
import { Link, useParams } from "@remix-run/react";
import {
ArrowLeft,
ArrowRight,
Calendar,
Check,
CheckCircle2,
ChevronDown,
ChevronUp,
Clock,
Eye,
ListPlus,
MapPin,
Plus,
Send,
Settings,
Trash2,
X,
} from "lucide-react";
import { useState } from "react";

export const meta: MetaFunction = () => {
return [{ title: "Create Multiple Events — My Call Time" }];
};

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_GROUP_ID = "mock-group-1";
const MOCK_GROUP_NAME = "Chicago Improv Collective";
const MOCK_MEMBER_COUNT = 8;

const SUGGESTED_DATES = [
{ date: "2026-03-19", location: "iO Theater - 1501 N Kingsbury St" },
{ date: "2026-03-26", location: "Second City Training Center - 230 W North Ave" },
{ date: "2026-04-02", location: "iO Theater - 1501 N Kingsbury St" },
{ date: "2026-04-09", location: "Annoyance Theatre - 851 W Belmont Ave" },
{ date: "2026-04-16", location: "iO Theater - 1501 N Kingsbury St" },
{ date: "2026-04-23", location: "CIC Theater - 4049 W Lawrence Ave" },
{ date: "2026-04-30", location: "iO Theater - 1501 N Kingsbury St" },
{ date: "2026-05-07", location: "Second City Training Center - 230 W North Ave" },
{ date: "2026-05-14", location: "iO Theater - 1501 N Kingsbury St" },
{ date: "2026-05-21", location: "Annoyance Theatre - 851 W Belmont Ave" },
{ date: "2026-05-28", location: "iO Theater - 1501 N Kingsbury St" },
{ date: "2026-06-04", location: "CIC Theater - 4049 W Lawrence Ave" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
const d = new Date(dateStr + "T12:00:00");
return d.toLocaleDateString("en-US", {
weekday: "short",
month: "short",
day: "numeric",
year: "numeric",
});
}

function getDayName(dateStr: string): string {
const d = new Date(dateStr + "T12:00:00");
return d.toLocaleDateString("en-US", { weekday: "short" });
}

function formatTime12(time24: string): string {
const [h, m] = time24.split(":").map(Number);
const ampm = h >= 12 ? "PM" : "AM";
const h12 = h % 12 || 12;
return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatDateShort(dateStr: string): string {
const d = new Date(dateStr + "T12:00:00");
return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface EventRow {
id: string;
date: string;
startTime: string;
endTime: string;
location: string;
}

// ─── Step Indicator ─────────────────────────────────────────────────────────

const STEPS = [
{ num: 1, label: "Details" },
{ num: 2, label: "Dates" },
{ num: 3, label: "Review" },
{ num: 4, label: "Done!" },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
return (
<nav className="mb-8" aria-label="Progress">
<ol className="flex items-center justify-center gap-0">
{STEPS.map((s, i) => {
const isCompleted = s.num < currentStep;
const isCurrent = s.num === currentStep;
const isFuture = s.num > currentStep;

return (
<li key={s.num} className="flex items-center">
<div className="flex flex-col items-center">
<div
className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
isCompleted
? "bg-emerald-500 text-white"
: isCurrent
? "bg-emerald-600 text-white ring-4 ring-emerald-100"
: "bg-slate-200 text-slate-500"
}`}
>
{isCompleted ? <Check className="h-5 w-5" /> : s.num}
</div>
<span
className={`mt-1.5 text-xs font-medium ${
isCurrent
? "text-emerald-700 font-bold"
: isCompleted
? "text-emerald-600"
: "text-slate-400"
}`}
>
{s.label}
</span>
</div>
{i < STEPS.length - 1 && (
<div
className={`mx-2 mt-[-1.25rem] h-0.5 w-16 sm:w-24 transition-colors duration-300 ${
s.num < currentStep ? "bg-emerald-500" : "bg-slate-200"
}`}
/>
)}
</li>
);
})}
</ol>
</nav>
);
}

// ─── Event Type Selector ────────────────────────────────────────────────────

const EVENT_TYPES = [
{ value: "rehearsal", label: "Rehearsal", emoji: "🎯" },
{ value: "show", label: "Show", emoji: "🎭" },
{ value: "other", label: "Other", emoji: "��" },
] as const;

function EventTypeSelector({
value,
onChange,
}: {
value: string;
onChange: (v: "rehearsal" | "show" | "other") => void;
}) {
return (
<div className="flex gap-3">
{EVENT_TYPES.map((t) => (
<button
key={t.value}
type="button"
onClick={() => onChange(t.value)}
className={`flex-1 rounded-lg border-2 px-4 py-3 text-center text-sm font-medium transition-all ${
value === t.value
? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
: "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
}`}
>
<span className="mr-1.5">{t.emoji}</span>
{t.label}
</button>
))}
</div>
);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function BatchCreateEvents() {
const params = useParams();
const groupId = params.groupId ?? MOCK_GROUP_ID;

// Wizard state
const [step, setStep] = useState(1);
const [title, setTitle] = useState("Thursday Rehearsal");
const [eventType, setEventType] = useState<"rehearsal" | "show" | "other">("rehearsal");
const [defaultStartTime, setDefaultStartTime] = useState("19:00");
const [defaultEndTime, setDefaultEndTime] = useState("21:00");
const [defaultLocation, setDefaultLocation] = useState("iO Theater - 1501 N Kingsbury St");
const [description, setDescription] = useState("");

// Events list - pre-populated with suggested dates
const [events, setEvents] = useState<EventRow[]>(() =>
SUGGESTED_DATES.map((d) => ({
id: crypto.randomUUID(),
date: d.date,
startTime: "19:00",
endTime: "21:00",
location: d.location,
})),
);

// Inline editing state
const [editingId, setEditingId] = useState<string | null>(null);
const [editStartTime, setEditStartTime] = useState("");
const [editEndTime, setEditEndTime] = useState("");
const [editLocation, setEditLocation] = useState("");

// Add date state
const [newDate, setNewDate] = useState("");

// Validation
const [errors, setErrors] = useState<Record<string, string>>({});

// Step navigation
function goNext() {
if (step === 1) {
if (!title.trim()) {
setErrors({ title: "Title is required" });
return;
}
setErrors({});
}
if (step === 2) {
if (events.length === 0) {
setErrors({ dates: "Add at least one date" });
return;
}
setErrors({});
}
setStep((s) => Math.min(s + 1, 4));
}

function goBack() {
setErrors({});
setStep((s) => Math.max(s - 1, 1));
}

// Event row operations
function startEditing(ev: EventRow) {
setEditingId(ev.id);
setEditStartTime(ev.startTime);
setEditEndTime(ev.endTime);
setEditLocation(ev.location);
}

function saveEdit(id: string) {
setEvents((prev) =>
prev.map((e) =>
e.id === id
? { ...e, startTime: editStartTime, endTime: editEndTime, location: editLocation }
: e,
),
);
setEditingId(null);
}

function cancelEdit() {
setEditingId(null);
}

function removeEvent(id: string) {
setEvents((prev) => prev.filter((e) => e.id !== id));
}

function addDate() {
if (!newDate) return;
if (events.some((e) => e.date === newDate)) {
setErrors({ newDate: "This date is already added" });
return;
}
setEvents((prev) =>
[
...prev,
{
id: crypto.randomUUID(),
date: newDate,
startTime: defaultStartTime,
endTime: defaultEndTime,
location: defaultLocation,
},
].sort((a, b) => a.date.localeCompare(b.date)),
);
setNewDate("");
setErrors({});
}

function handleCreate() {
// Simulate creation - go to success step
setStep(4);
}

// Count overrides
const overrideCount = events.filter(
(e) =>
e.startTime !== defaultStartTime ||
e.endTime !== defaultEndTime ||
e.location !== defaultLocation,
).length;

return (
<div className="min-h-screen bg-slate-50">
<div className="mx-auto max-w-4xl px-4 py-8">
{/* Header */}
{step < 4 && (
<div className="mb-6">
<Link
to={`/groups/${groupId}/events`}
className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
>
<ArrowLeft className="h-4 w-4" />
Back to Events
</Link>
<h1 className="text-2xl font-bold text-slate-900">Create Multiple Events</h1>
<p className="mt-1 text-sm text-slate-500">
Set up a batch of events with shared details and individual date/location settings.
</p>
</div>
)}

{/* Step Indicator */}
<StepIndicator currentStep={step} />

{/* Step Content */}
<div className="transition-all duration-200">
{step === 1 && (
<Step1SharedDetails
title={title}
setTitle={setTitle}
eventType={eventType}
setEventType={setEventType}
defaultStartTime={defaultStartTime}
setDefaultStartTime={setDefaultStartTime}
defaultEndTime={defaultEndTime}
setDefaultEndTime={setDefaultEndTime}
defaultLocation={defaultLocation}
setDefaultLocation={setDefaultLocation}
description={description}
setDescription={setDescription}
errors={errors}
onNext={goNext}
/>
)}
{step === 2 && (
<Step2Dates
events={events}
defaultStartTime={defaultStartTime}
defaultEndTime={defaultEndTime}
defaultLocation={defaultLocation}
editingId={editingId}
editStartTime={editStartTime}
editEndTime={editEndTime}
editLocation={editLocation}
setEditStartTime={setEditStartTime}
setEditEndTime={setEditEndTime}
setEditLocation={setEditLocation}
startEditing={startEditing}
saveEdit={saveEdit}
cancelEdit={cancelEdit}
removeEvent={removeEvent}
newDate={newDate}
setNewDate={setNewDate}
addDate={addDate}
errors={errors}
onBack={goBack}
onNext={goNext}
/>
)}
{step === 3 && (
<Step3Review
title={title}
eventType={eventType}
defaultStartTime={defaultStartTime}
defaultEndTime={defaultEndTime}
events={events}
overrideCount={overrideCount}
onBack={goBack}
onCreate={handleCreate}
/>
)}
{step === 4 && (
<Step4Success eventCount={events.length} groupId={groupId} onReset={() => setStep(1)} />
)}
</div>
</div>
</div>
);
}

// ─── Step 1: Shared Details ─────────────────────────────────────────────────

function Step1SharedDetails({
title,
setTitle,
eventType,
setEventType,
defaultStartTime,
setDefaultStartTime,
defaultEndTime,
setDefaultEndTime,
defaultLocation,
setDefaultLocation,
description,
setDescription,
errors,
onNext,
}: {
title: string;
setTitle: (v: string) => void;
eventType: "rehearsal" | "show" | "other";
setEventType: (v: "rehearsal" | "show" | "other") => void;
defaultStartTime: string;
setDefaultStartTime: (v: string) => void;
defaultEndTime: string;
setDefaultEndTime: (v: string) => void;
defaultLocation: string;
setDefaultLocation: (v: string) => void;
description: string;
setDescription: (v: string) => void;
errors: Record<string, string>;
onNext: () => void;
}) {
return (
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<div className="mb-5 flex items-center gap-2">
<Settings className="h-5 w-5 text-emerald-600" />
<h2 className="text-lg font-semibold text-slate-900">Shared Details</h2>
</div>
<p className="mb-6 text-sm text-slate-500">
These settings apply to all events. You can override dates and locations in the next step.
</p>

<div className="space-y-5">
{/* Title */}
<div>
<label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1.5">
Event Title
</label>
<input
id="title"
type="text"
value={title}
onChange={(e) => setTitle(e.target.value)}
className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none ${
errors.title ? "border-red-300 bg-red-50" : "border-slate-300"
}`}
placeholder="e.g., Thursday Rehearsal"
/>
{errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
</div>

{/* Event Type */}
<div>
<label className="block text-sm font-medium text-slate-700 mb-1.5">Event Type</label>
<EventTypeSelector value={eventType} onChange={setEventType} />
</div>

{/* Time Fields */}
<div className="grid grid-cols-2 gap-4">
<div>
<label
htmlFor="startTime"
className="block text-sm font-medium text-slate-700 mb-1.5"
>
Default Start Time
</label>
<div className="relative">
<Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
<input
id="startTime"
type="time"
value={defaultStartTime}
onChange={(e) => setDefaultStartTime(e.target.value)}
className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>
</div>
<div>
<label
htmlFor="endTime"
className="block text-sm font-medium text-slate-700 mb-1.5"
>
Default End Time
</label>
<div className="relative">
<Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
<input
id="endTime"
type="time"
value={defaultEndTime}
onChange={(e) => setDefaultEndTime(e.target.value)}
className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>
</div>
</div>

{/* Default Location */}
<div>
<label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-1.5">
Default Location
</label>
<div className="relative">
<MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
<input
id="location"
type="text"
value={defaultLocation}
onChange={(e) => setDefaultLocation(e.target.value)}
className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
placeholder="e.g., iO Theater"
/>
</div>
</div>

{/* Description */}
<div>
<label htmlFor="desc" className="block text-sm font-medium text-slate-700 mb-1.5">
Description <span className="text-slate-400 font-normal">(optional)</span>
</label>
<textarea
id="desc"
value={description}
onChange={(e) => setDescription(e.target.value)}
rows={3}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none resize-none"
placeholder="Add any notes that apply to all events..."
/>
</div>
</div>

{/* Navigation */}
<div className="mt-8 flex justify-end">
<button
type="button"
onClick={onNext}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
>
Next: Add Dates
<ArrowRight className="h-4 w-4" />
</button>
</div>
</div>
);
}

// ─── Step 2: Dates & Location Overrides ─────────────────────────────────────

function Step2Dates({
events,
defaultStartTime,
defaultEndTime,
defaultLocation,
editingId,
editStartTime,
editEndTime,
editLocation,
setEditStartTime,
setEditEndTime,
setEditLocation,
startEditing,
saveEdit,
cancelEdit,
removeEvent,
newDate,
setNewDate,
addDate,
errors,
onBack,
onNext,
}: {
events: EventRow[];
defaultStartTime: string;
defaultEndTime: string;
defaultLocation: string;
editingId: string | null;
editStartTime: string;
editEndTime: string;
editLocation: string;
setEditStartTime: (v: string) => void;
setEditEndTime: (v: string) => void;
setEditLocation: (v: string) => void;
startEditing: (ev: EventRow) => void;
saveEdit: (id: string) => void;
cancelEdit: () => void;
removeEvent: (id: string) => void;
newDate: string;
setNewDate: (v: string) => void;
addDate: () => void;
errors: Record<string, string>;
onBack: () => void;
onNext: () => void;
}) {
return (
<div className="space-y-4">
{/* Summary Bar */}
<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<div className="flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
<Calendar className="h-5 w-5 text-emerald-600" />
</div>
<div>
<p className="text-sm font-semibold text-slate-900">
{events.length} {events.length === 1 ? "date" : "dates"} selected
</p>
<p className="text-xs text-slate-500">
{events.length > 0
? `${formatDateShort(events[0].date)} – ${formatDateShort(events[events.length - 1].date)}`
: "No dates added yet"}
</p>
</div>
</div>
{errors.dates && <p className="text-sm text-red-600">{errors.dates}</p>}
</div>
</div>

{/* Date Table */}
<div className="rounded-xl border border-slate-200 bg-white shadow-sm">
<div className="border-b border-slate-100 px-6 py-4">
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<ListPlus className="h-5 w-5 text-emerald-600" />
<h2 className="text-lg font-semibold text-slate-900">Event Dates</h2>
</div>
</div>
<p className="mt-1 text-sm text-slate-500">
Edit individual times and locations, or add new dates.
</p>
</div>

{/* Table */}
<div className="overflow-x-auto">
<table className="w-full">
<thead>
<tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
<th className="px-6 py-3 w-8">#</th>
<th className="px-4 py-3">Date</th>
<th className="px-4 py-3 hidden sm:table-cell">Day</th>
<th className="px-4 py-3">Start</th>
<th className="px-4 py-3">End</th>
<th className="px-4 py-3">Location</th>
<th className="px-4 py-3 w-24 text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-50">
{events.map((ev, i) => {
const isEditing = editingId === ev.id;
const hasTimeOverride =
ev.startTime !== defaultStartTime || ev.endTime !== defaultEndTime;
const hasLocationOverride = ev.location !== defaultLocation;

if (isEditing) {
return (
<tr key={ev.id} className="bg-emerald-50/50">
<td className="px-6 py-3 text-sm text-slate-400">{i + 1}</td>
<td className="px-4 py-3 text-sm font-medium text-slate-900">
{formatDateShort(ev.date)}
</td>
<td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-500">
{getDayName(ev.date)}
</td>
<td className="px-4 py-3">
<input
type="time"
value={editStartTime}
onChange={(e) => setEditStartTime(e.target.value)}
className="w-28 rounded border border-emerald-300 px-2 py-1 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</td>
<td className="px-4 py-3">
<input
type="time"
value={editEndTime}
onChange={(e) => setEditEndTime(e.target.value)}
className="w-28 rounded border border-emerald-300 px-2 py-1 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</td>
<td className="px-4 py-3">
<input
type="text"
value={editLocation}
onChange={(e) => setEditLocation(e.target.value)}
className="w-full min-w-[180px] rounded border border-emerald-300 px-2 py-1 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</td>
<td className="px-4 py-3 text-right">
<div className="flex items-center justify-end gap-1">
<button
type="button"
onClick={() => saveEdit(ev.id)}
className="rounded p-1.5 text-emerald-600 hover:bg-emerald-100 transition-colors"
title="Save"
>
<Check className="h-4 w-4" />
</button>
<button
type="button"
onClick={cancelEdit}
className="rounded p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
title="Cancel"
>
<X className="h-4 w-4" />
</button>
</div>
</td>
</tr>
);
}

return (
<tr
key={ev.id}
className="group hover:bg-slate-50/80 transition-colors"
>
<td className="px-6 py-3 text-sm text-slate-400">{i + 1}</td>
<td className="px-4 py-3 text-sm font-medium text-slate-900">
{formatDateShort(ev.date)}
</td>
<td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-500">
{getDayName(ev.date)}
</td>
<td className="px-4 py-3 text-sm">
<span className={hasTimeOverride ? "font-semibold text-emerald-700" : "text-slate-600"}>
{formatTime12(ev.startTime)}
</span>
{hasTimeOverride && (
<span className="ml-1.5 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
custom
</span>
)}
</td>
<td className="px-4 py-3 text-sm">
<span className={hasTimeOverride ? "font-semibold text-emerald-700" : "text-slate-600"}>
{formatTime12(ev.endTime)}
</span>
</td>
<td className="px-4 py-3 text-sm">
<span
className={`${hasLocationOverride ? "font-semibold text-emerald-700" : "text-slate-600"} max-w-[220px] truncate inline-block`}
title={ev.location}
>
{ev.location}
</span>
{hasLocationOverride && (
<span className="ml-1.5 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
custom
</span>
)}
</td>
<td className="px-4 py-3 text-right">
<div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
<button
type="button"
onClick={() => startEditing(ev)}
className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
title="Edit"
>
<Settings className="h-4 w-4" />
</button>
<button
type="button"
onClick={() => removeEvent(ev.id)}
className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
title="Remove"
>
<Trash2 className="h-4 w-4" />
</button>
</div>
</td>
</tr>
);
})}
</tbody>
</table>
</div>

{/* Add Date Row */}
<div className="border-t border-slate-100 px-6 py-4">
<div className="flex items-center gap-3">
<input
type="date"
value={newDate}
onChange={(e) => setNewDate(e.target.value)}
className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
<button
type="button"
onClick={addDate}
disabled={!newDate}
className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
>
<Plus className="h-4 w-4" />
Add Date
</button>
{errors.newDate && (
<p className="text-sm text-red-600">{errors.newDate}</p>
)}
</div>
</div>
</div>

{/* Navigation */}
<div className="flex justify-between pt-2">
<button
type="button"
onClick={onBack}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
>
<ArrowLeft className="h-4 w-4" />
Back
</button>
<button
type="button"
onClick={onNext}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
>
Next: Review
<ArrowRight className="h-4 w-4" />
</button>
</div>
</div>
);
}

// ─── Step 3: Review ─────────────────────────────────────────────────────────

function Step3Review({
title,
eventType,
defaultStartTime,
defaultEndTime,
events,
overrideCount,
onBack,
onCreate,
}: {
title: string;
eventType: string;
defaultStartTime: string;
defaultEndTime: string;
events: EventRow[];
overrideCount: number;
onBack: () => void;
onCreate: () => void;
}) {
const typeLabel = EVENT_TYPES.find((t) => t.value === eventType);

return (
<div className="space-y-4">
{/* Summary Card */}
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<div className="flex items-start gap-4">
<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
<ListPlus className="h-6 w-6 text-emerald-600" />
</div>
<div className="flex-1">
<h2 className="text-lg font-semibold text-slate-900">
{events.length} Events to Create
</h2>
<div className="mt-2 space-y-1 text-sm text-slate-600">
<p>
<span className="font-medium text-slate-700">Title:</span> {title}
</p>
<p>
<span className="font-medium text-slate-700">Type:</span>{" "}
{typeLabel ? `${typeLabel.emoji} ${typeLabel.label}` : eventType}
</p>
<p>
<span className="font-medium text-slate-700">Default Time:</span>{" "}
{formatTime12(defaultStartTime)} – {formatTime12(defaultEndTime)}
{overrideCount > 0 && (
<span className="ml-2 text-emerald-600">
({overrideCount} {overrideCount === 1 ? "event" : "events"} with custom settings)
</span>
)}
</p>
</div>
</div>
</div>
</div>

{/* Event Grid */}
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<div className="mb-4 flex items-center gap-2">
<Eye className="h-5 w-5 text-emerald-600" />
<h3 className="text-base font-semibold text-slate-900">Event Preview</h3>
</div>
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
{events.map((ev) => (
<div
key={ev.id}
className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 hover:border-emerald-200 transition-colors"
>
<p className="text-sm font-semibold text-slate-900">
{formatDateDisplay(ev.date)}
</p>
<div className="mt-2 space-y-1">
<p className="flex items-center gap-1.5 text-xs text-slate-500">
<Clock className="h-3.5 w-3.5" />
{formatTime12(ev.startTime)} – {formatTime12(ev.endTime)}
</p>
<p
className="flex items-start gap-1.5 text-xs text-slate-500"
title={ev.location}
>
<MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
<span className="truncate">{ev.location}</span>
</p>
</div>
</div>
))}
</div>
</div>

{/* Notification Preview */}
<div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
<div className="flex items-start gap-3">
<Send className="h-5 w-5 text-emerald-600 mt-0.5" />
<div>
<h3 className="text-sm font-semibold text-emerald-900">Notification Summary</h3>
<p className="mt-1 text-sm text-emerald-700">
One consolidated email will be sent to{" "}
<span className="font-semibold">{MOCK_MEMBER_COUNT} members</span> of "
{MOCK_GROUP_NAME}" with details of all {events.length} events.
</p>
</div>
</div>
</div>

{/* Navigation */}
<div className="flex justify-between pt-2">
<button
type="button"
onClick={onBack}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
>
<ArrowLeft className="h-4 w-4" />
Edit Events
</button>
<button
type="button"
onClick={onCreate}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm transition-colors"
>
<CheckCircle2 className="h-4 w-4" />
Create All Events & Notify
</button>
</div>
</div>
);
}

// ─── Step 4: Success ────────────────────────────────────────────────────────

function Step4Success({
eventCount,
groupId,
onReset,
}: {
eventCount: number;
groupId: string;
onReset: () => void;
}) {
return (
<div className="flex flex-col items-center justify-center py-12">
<div className="animate-[scale-in_0.4s_ease-out] mb-6">
<div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
<CheckCircle2 className="h-10 w-10 text-emerald-600" />
</div>
</div>
<h2 className="text-2xl font-bold text-slate-900">
{eventCount} Events Created Successfully!
</h2>
<p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
<Send className="h-4 w-4" />
One notification sent to {MOCK_MEMBER_COUNT} members
</p>

<div className="mt-8 flex items-center gap-3">
<Link
to={`/groups/${groupId}/events`}
className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
>
View All Events
<ArrowRight className="h-4 w-4" />
</Link>
<button
type="button"
onClick={onReset}
className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
>
Create Another Batch
</button>
</div>
</div>
);
}
