import type { MetaFunction } from "@remix-run/node";
import { useState, useCallback, useMemo } from "react";
import {
ShoppingCart,
Check,
X,
Calendar,
Clock,
MapPin,
Plus,
Trash2,
Edit2,
CheckSquare,
Square,
Send,
Sparkles,
ChevronRight,
ArrowLeft,
PartyPopper,
Mail,
} from "lucide-react";

export const meta: MetaFunction = () => {
return [{ title: "Draft Cart Demo — My Call Time" }];
};

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

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

interface DraftEvent {
id: string;
title: string;
eventType: "rehearsal" | "show" | "other";
date: string;
startTime: string;
endTime: string;
location: string;
description: string;
}

function generateId(): string {
return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function makeDraft(date: string, index: number): DraftEvent {
return {
id: generateId(),
title: "Thursday Rehearsal",
eventType: "rehearsal",
date,
startTime: "19:00",
endTime: "21:00",
location: LOCATIONS[index % LOCATIONS.length],
description: "",
};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
const d = new Date(dateStr + "T12:00:00");
return d.toLocaleDateString("en-US", {
weekday: "short",
month: "short",
day: "numeric",
year: "numeric",
});
}

function formatDateShort(dateStr: string): string {
const d = new Date(dateStr + "T12:00:00");
return d.toLocaleDateString("en-US", {
weekday: "short",
month: "short",
day: "numeric",
});
}

function formatTime(time24: string): string {
const [h, m] = time24.split(":").map(Number);
const ampm = h >= 12 ? "PM" : "AM";
const h12 = h % 12 || 12;
return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const EVENT_TYPE_EMOJI: Record<string, string> = {
rehearsal: "🎯",
show: "🎭",
other: "📌",
};

// ---------------------------------------------------------------------------
// Phase type
// ---------------------------------------------------------------------------

type Phase = "create" | "quick-add" | "cart" | "confirm" | "success";

// ---------------------------------------------------------------------------
// Component: Cart Badge (always visible)
// ---------------------------------------------------------------------------

function CartBadge({
count,
onClick,
active,
}: { count: number; onClick: () => void; active: boolean }) {
return (
<button
type="button"
onClick={onClick}
className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
active
? "bg-amber-500 text-white shadow-md shadow-amber-500/25"
: count > 0
? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
: "border border-slate-300 bg-white text-slate-400"
}`}
>
<ShoppingCart className="h-4 w-4" />
<span>Draft Cart</span>
{count > 0 && (
<span
className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold transition-all ${
active ? "bg-white text-amber-600" : "bg-amber-500 text-white"
}`}
>
{count}
</span>
)}
</button>
);
}

// ---------------------------------------------------------------------------
// Component: Event Creation Form
// ---------------------------------------------------------------------------

function EventCreationForm({
onSaveDraft,
}: {
onSaveDraft: (draft: DraftEvent) => void;
}) {
const [title, setTitle] = useState("Thursday Rehearsal");
const [eventType, setEventType] = useState<"rehearsal" | "show" | "other">(
"rehearsal",
);
const [date, setDate] = useState("2026-04-02");
const [startTime, setStartTime] = useState("19:00");
const [endTime, setEndTime] = useState("21:00");
const [location, setLocation] = useState("Main Stage");
const [saved, setSaved] = useState(false);

const handleSaveDraft = () => {
onSaveDraft({
id: generateId(),
title,
eventType,
date,
startTime,
endTime,
location,
description: "",
});
setSaved(true);
setTimeout(() => setSaved(false), 1500);
};

return (
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<h3 className="mb-4 text-lg font-semibold text-slate-900">
Create Event
</h3>

<div className="space-y-4">
{/* Title */}
<div>
<label className="mb-1 block text-sm font-medium text-slate-700">
Title
</label>
<input
type="text"
value={title}
onChange={(e) => setTitle(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>

{/* Event Type */}
<div>
<label className="mb-1 block text-sm font-medium text-slate-700">
Type
</label>
<div className="flex gap-2">
{(["rehearsal", "show", "other"] as const).map((type) => (
<button
key={type}
type="button"
onClick={() => setEventType(type)}
className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
eventType === type
? "bg-emerald-600 text-white"
: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
}`}
>
{EVENT_TYPE_EMOJI[type]} {type}
</button>
))}
</div>
</div>

{/* Date & Time */}
<div className="grid grid-cols-3 gap-3">
<div>
<label className="mb-1 block text-sm font-medium text-slate-700">
Date
</label>
<input
type="date"
value={date}
onChange={(e) => setDate(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>
<div>
<label className="mb-1 block text-sm font-medium text-slate-700">
Start Time
</label>
<input
type="time"
value={startTime}
onChange={(e) => setStartTime(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>
<div>
<label className="mb-1 block text-sm font-medium text-slate-700">
End Time
</label>
<input
type="time"
value={endTime}
onChange={(e) => setEndTime(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>
</div>

{/* Location */}
<div>
<label className="mb-1 block text-sm font-medium text-slate-700">
Location
</label>
<input
type="text"
value={location}
onChange={(e) => setLocation(e.target.value)}
className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
/>
</div>

{/* Buttons */}
<div className="flex items-center gap-3 pt-2">
<button
type="button"
onClick={handleSaveDraft}
className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
saved
? "border-emerald-300 bg-emerald-50 text-emerald-700"
: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
}`}
>
{saved ? (
<>
<Check className="h-4 w-4" /> Saved!
</>
) : (
<>
<ShoppingCart className="h-4 w-4" /> Save as Draft
</>
)}
</button>
<button
type="button"
className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
>
Create Event
</button>
</div>
</div>
</div>
);
}

// ---------------------------------------------------------------------------
// Component: Quick Add Builder
// ---------------------------------------------------------------------------

function QuickAddBuilder({
existingDraftDates,
onAddDrafts,
}: {
existingDraftDates: Set<string>;
onAddDrafts: (drafts: DraftEvent[]) => void;
}) {
const availableDates = MOCK_DATES.filter((d) => !existingDraftDates.has(d));
const [selected, setSelected] = useState<Set<string>>(
new Set(availableDates),
);

const toggleDate = (date: string) => {
setSelected((prev) => {
const next = new Set(prev);
if (next.has(date)) next.delete(date);
else next.add(date);
return next;
});
};

const toggleAll = () => {
if (selected.size === availableDates.length) {
setSelected(new Set());
} else {
setSelected(new Set(availableDates));
}
};

const handleAdd = () => {
const drafts = availableDates
.filter((d) => selected.has(d))
.map((date, i) => {
const globalIndex = MOCK_DATES.indexOf(date);
return makeDraft(date, globalIndex);
});
onAddDrafts(drafts);
};

if (availableDates.length === 0) {
return (
<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
<Check className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
<p className="font-medium text-emerald-800">
All 12 Thursdays are in your cart!
</p>
</div>
);
}

return (
<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
<div className="mb-4 flex items-center justify-between">
<div>
<h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
<Sparkles className="h-5 w-5 text-amber-500" />
Quick Add Thursdays
</h3>
<p className="mt-1 text-sm text-slate-500">
Select dates to batch-add to your draft cart
</p>
</div>
<button
type="button"
onClick={toggleAll}
className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
>
{selected.size === availableDates.length
? "Deselect All"
: "Select All"}
</button>
</div>

<div className="overflow-hidden rounded-lg border border-slate-200">
<table className="w-full text-sm">
<thead>
<tr className="border-b border-slate-200 bg-slate-50">
<th className="w-10 py-2 px-3 text-left" />
<th className="py-2 px-3 text-left font-medium text-slate-600">
Date
</th>
<th className="py-2 px-3 text-left font-medium text-slate-600">
Time
</th>
<th className="py-2 px-3 text-left font-medium text-slate-600">
Location
</th>
</tr>
</thead>
<tbody>
{availableDates.map((date) => {
const globalIndex = MOCK_DATES.indexOf(date);
const loc = LOCATIONS[globalIndex % LOCATIONS.length];
const isSelected = selected.has(date);
return (
<tr
key={date}
onClick={() => toggleDate(date)}
className={`cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 ${
isSelected
? "bg-amber-50/60 hover:bg-amber-50"
: "hover:bg-slate-50"
}`}
>
<td className="py-2.5 px-3">
{isSelected ? (
<CheckSquare className="h-4 w-4 text-amber-600" />
) : (
<Square className="h-4 w-4 text-slate-300" />
)}
</td>
<td className="py-2.5 px-3 font-medium text-slate-900">
{formatDateShort(date)}
</td>
<td className="py-2.5 px-3 text-slate-600">
7:00 PM – 9:00 PM
</td>
<td className="py-2.5 px-3 text-slate-600">{loc}</td>
</tr>
);
})}
</tbody>
</table>
</div>

<div className="mt-4 flex items-center justify-between">
<span className="text-sm text-slate-500">
{selected.size} of {availableDates.length} dates selected
</span>
<button
type="button"
onClick={handleAdd}
disabled={selected.size === 0}
className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
>
<Plus className="h-4 w-4" />
Add {selected.size} to Cart
</button>
</div>
</div>
);
}

// ---------------------------------------------------------------------------
// Component: Draft Card
// ---------------------------------------------------------------------------

function DraftCard({
draft,
isSelected,
onToggle,
onDelete,
onEdit,
}: {
draft: DraftEvent;
isSelected: boolean;
onToggle: () => void;
onDelete: () => void;
onEdit: () => void;
}) {
return (
<div
className={`group rounded-xl border p-4 transition-all ${
isSelected
? "border-amber-300 bg-amber-50/50 shadow-sm"
: "border-slate-200 bg-white hover:border-slate-300"
}`}
>
<div className="flex items-start gap-3">
{/* Checkbox */}
<button
type="button"
onClick={onToggle}
className="mt-0.5 shrink-0"
>
{isSelected ? (
<CheckSquare className="h-5 w-5 text-amber-600" />
) : (
<Square className="h-5 w-5 text-slate-300 group-hover:text-slate-400" />
)}
</button>

{/* Content */}
<div className="min-w-0 flex-1">
<div className="flex items-center gap-2">
<span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
{EVENT_TYPE_EMOJI[draft.eventType]} Rehearsal
</span>
<span className="font-medium text-slate-900">{draft.title}</span>
</div>
<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
<span className="flex items-center gap-1">
<Calendar className="h-3.5 w-3.5" />
{formatDateShort(draft.date)}
</span>
<span className="flex items-center gap-1">
<Clock className="h-3.5 w-3.5" />
{formatTime(draft.startTime)} – {formatTime(draft.endTime)}
</span>
<span className="flex items-center gap-1">
<MapPin className="h-3.5 w-3.5" />
{draft.location}
</span>
</div>
</div>

{/* Actions */}
<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
<button
type="button"
onClick={onEdit}
className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
title="Edit"
>
<Edit2 className="h-4 w-4" />
</button>
<button
type="button"
onClick={onDelete}
className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
title="Delete"
>
<Trash2 className="h-4 w-4" />
</button>
</div>
</div>
</div>
);
}

// ---------------------------------------------------------------------------
// Component: Draft Cart View
// ---------------------------------------------------------------------------

function DraftCartView({
drafts,
onPublishSelected,
onPublishAll,
onDelete,
}: {
drafts: DraftEvent[];
onPublishSelected: (ids: string[]) => void;
onPublishAll: () => void;
onDelete: (id: string) => void;
}) {
const [selectedIds, setSelectedIds] = useState<Set<string>>(
new Set(drafts.map((d) => d.id)),
);

const toggleId = (id: string) => {
setSelectedIds((prev) => {
const next = new Set(prev);
if (next.has(id)) next.delete(id);
else next.add(id);
return next;
});
};

const toggleAll = () => {
if (selectedIds.size === drafts.length) {
setSelectedIds(new Set());
} else {
setSelectedIds(new Set(drafts.map((d) => d.id)));
}
};

// Group by month
const grouped = useMemo(() => {
const groups: Record<string, DraftEvent[]> = {};
for (const draft of drafts) {
const d = new Date(draft.date + "T12:00:00");
const key = d.toLocaleDateString("en-US", {
month: "long",
year: "numeric",
});
if (!groups[key]) groups[key] = [];
groups[key].push(draft);
}
return Object.entries(groups);
}, [drafts]);

return (
<div className="space-y-4">
{/* Toolbar */}
<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<div className="flex items-center gap-3">
<button
type="button"
onClick={toggleAll}
className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
>
{selectedIds.size === drafts.length ? (
<CheckSquare className="h-4 w-4 text-amber-600" />
) : (
<Square className="h-4 w-4 text-slate-400" />
)}
{selectedIds.size === drafts.length
? "Deselect All"
: "Select All"}
</button>
<span className="text-sm text-slate-500">
{selectedIds.size} of {drafts.length} selected
</span>
</div>

<div className="flex items-center gap-2">
{selectedIds.size > 0 && selectedIds.size < drafts.length && (
<button
type="button"
onClick={() => onPublishSelected(Array.from(selectedIds))}
className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
>
<Send className="h-4 w-4" />
Publish Selected ({selectedIds.size})
</button>
)}
<button
type="button"
onClick={onPublishAll}
className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
>
<Send className="h-4 w-4" />
Publish All ({drafts.length})
</button>
</div>
</div>

{/* Summary */}
<div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
<ShoppingCart className="h-4 w-4 text-amber-600" />
<span className="text-sm font-medium text-amber-800">
{drafts.length} draft{drafts.length !== 1 ? "s" : ""} ready to publish
</span>
</div>

{/* Grouped Draft Cards */}
{grouped.map(([month, monthDrafts]) => (
<div key={month}>
<h4 className="mb-2 text-sm font-semibold text-slate-500 uppercase tracking-wide">
{month}
</h4>
<div className="space-y-2">
{monthDrafts.map((draft) => (
<DraftCard
key={draft.id}
draft={draft}
isSelected={selectedIds.has(draft.id)}
onToggle={() => toggleId(draft.id)}
onDelete={() => onDelete(draft.id)}
onEdit={() => {}}
/>
))}
</div>
</div>
))}
</div>
);
}

// ---------------------------------------------------------------------------
// Component: Publish Confirmation Modal
// ---------------------------------------------------------------------------

function PublishModal({
drafts,
onConfirm,
onCancel,
}: {
drafts: DraftEvent[];
onConfirm: () => void;
onCancel: () => void;
}) {
const [publishing, setPublishing] = useState(false);

const handleConfirm = () => {
setPublishing(true);
setTimeout(onConfirm, 1200);
};

return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
<div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
{/* Header */}
<div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
<h3 className="text-lg font-semibold text-slate-900">
Publish {drafts.length} Events
</h3>
<button
type="button"
onClick={onCancel}
disabled={publishing}
className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
>
<X className="h-5 w-5" />
</button>
</div>

{/* Body */}
<div className="px-6 py-4">
<div className="mb-4 flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
<Mail className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
<p className="text-sm text-emerald-800">
This will create{" "}
<span className="font-semibold">{drafts.length} events</span> and
send{" "}
<span className="font-semibold">
1 consolidated notification
</span>{" "}
to <span className="font-semibold">6 group members</span>.
</p>
</div>

{/* Scrollable event list */}
<div className="max-h-64 overflow-y-auto space-y-1.5 rounded-lg border border-slate-200 p-2">
{drafts.map((draft, i) => (
<div
key={draft.id}
className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
>
<span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
{i + 1}
</span>
<span className="font-medium text-slate-900 min-w-0 truncate">
{draft.title}
</span>
<span className="ml-auto shrink-0 text-slate-500">
{formatDateShort(draft.date)}
</span>
</div>
))}
</div>
</div>

{/* Footer */}
<div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
<button
type="button"
onClick={onCancel}
disabled={publishing}
className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
>
Cancel
</button>
<button
type="button"
onClick={handleConfirm}
disabled={publishing}
className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-70"
>
{publishing ? (
<>
<svg
className="h-4 w-4 animate-spin"
viewBox="0 0 24 24"
fill="none"
>
<circle
className="opacity-25"
cx="12"
cy="12"
r="10"
stroke="currentColor"
strokeWidth="4"
/>
<path
className="opacity-75"
fill="currentColor"
d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
/>
</svg>
Publishing…
</>
) : (
<>
<Send className="h-4 w-4" />
Publish {drafts.length} Events
</>
)}
</button>
</div>
</div>
</div>
);
}

// ---------------------------------------------------------------------------
// Component: Success View
// ---------------------------------------------------------------------------

function SuccessView({
count,
onReset,
}: { count: number; onReset: () => void }) {
return (
<div className="flex flex-col items-center justify-center py-16 text-center">
<div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 animate-bounce">
<PartyPopper className="h-10 w-10 text-emerald-600" />
</div>
<h2 className="text-2xl font-bold text-slate-900">Published!</h2>
<p className="mt-2 text-slate-600 max-w-md">
<span className="font-semibold text-emerald-700">{count} events</span>{" "}
created.{" "}
<span className="font-semibold text-emerald-700">
1 email notification
</span>{" "}
sent to{" "}
<span className="font-semibold text-emerald-700">6 members</span>.
</p>

<div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
<Mail className="h-4 w-4 text-emerald-600" />
<span>
Members received a single digest email instead of {count} separate
notifications
</span>
</div>

<div className="mt-8 flex gap-3">
<button
type="button"
onClick={onReset}
className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
>
<Calendar className="h-4 w-4" />
View Events
</button>
<button
type="button"
onClick={onReset}
className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
>
Start Over
</button>
</div>
</div>
);
}

// ---------------------------------------------------------------------------
// Component: Phase Stepper
// ---------------------------------------------------------------------------

function PhaseStepper({ phase }: { phase: Phase }) {
const steps: { key: Phase; label: string }[] = [
{ key: "create", label: "Create" },
{ key: "quick-add", label: "Quick Add" },
{ key: "cart", label: "Review" },
{ key: "confirm", label: "Publish" },
];

const currentIndex = steps.findIndex((s) => s.key === phase);

return (
<div className="flex items-center gap-1 text-sm">
{steps.map((step, i) => {
const isDone =
phase === "success" || i < currentIndex;
const isCurrent = step.key === phase;
return (
<div key={step.key} className="flex items-center gap-1">
{i > 0 && (
<ChevronRight
className={`h-3.5 w-3.5 ${isDone ? "text-emerald-400" : "text-slate-300"}`}
/>
)}
<span
className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
isDone
? "bg-emerald-100 text-emerald-700"
: isCurrent
? "bg-amber-100 text-amber-700"
: "bg-slate-100 text-slate-400"
}`}
>
{isDone && !isCurrent ? (
<Check className="inline h-3 w-3 -mt-0.5" />
) : null}{" "}
{step.label}
</span>
</div>
);
})}
</div>
);
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function DemoBatchCart() {
const [phase, setPhase] = useState<Phase>("create");
const [drafts, setDrafts] = useState<DraftEvent[]>([]);
const [publishCount, setPublishCount] = useState(0);

const draftDates = useMemo(() => new Set(drafts.map((d) => d.date)), [drafts]);

const handleSaveDraft = useCallback((draft: DraftEvent) => {
setDrafts((prev) => [...prev, draft]);
}, []);

const handleAddDrafts = useCallback((newDrafts: DraftEvent[]) => {
setDrafts((prev) => [...prev, ...newDrafts]);
}, []);

const handleDeleteDraft = useCallback((id: string) => {
setDrafts((prev) => prev.filter((d) => d.id !== id));
}, []);

const handlePublishAll = () => {
setPhase("confirm");
};

const handlePublishSelected = (ids: string[]) => {
// For demo, just publish all
setPhase("confirm");
};

const handleConfirmPublish = () => {
setPublishCount(drafts.length);
setDrafts([]);
setPhase("success");
};

const handleReset = () => {
setDrafts([]);
setPhase("create");
setPublishCount(0);
};

const handleCartClick = () => {
if (drafts.length > 0 && phase !== "cart" && phase !== "confirm") {
setPhase("cart");
}
};

return (
<div className="min-h-screen bg-slate-50">
{/* Header */}
<header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
<div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
<div className="flex items-center gap-4">
<h1 className="text-lg font-bold text-slate-900">
🎭 My Call Time
</h1>
<span className="rounded-full bg-violet-100 text-violet-700 px-2.5 py-0.5 text-xs font-medium">
Draft Cart Prototype
</span>
</div>

<div className="flex items-center gap-3">
<PhaseStepper phase={phase} />
<CartBadge
count={drafts.length}
onClick={handleCartClick}
active={phase === "cart"}
/>
</div>
</div>
</header>

{/* Main Content */}
<main className="mx-auto max-w-4xl px-6 py-8">
{/* Phase: Create */}
{phase === "create" && (
<div className="space-y-6">
<div>
<h2 className="text-2xl font-bold text-slate-900">
Create Events
</h2>
<p className="mt-1 text-slate-500">
Save events as drafts and publish them all at once
</p>
</div>

<EventCreationForm onSaveDraft={handleSaveDraft} />

{drafts.length > 0 && (
<div className="space-y-4">
<div className="flex items-center justify-between">
<h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
<Sparkles className="h-5 w-5 text-amber-500" />
Want to add more fast?
</h3>
<button
type="button"
onClick={() => setPhase("quick-add")}
className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
>
Quick Add Thursdays
<ChevronRight className="h-4 w-4" />
</button>
</div>

{/* Preview of saved drafts */}
<div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
<div className="flex items-center justify-between">
<span className="text-sm font-medium text-amber-800">
🛒 {drafts.length} draft
{drafts.length !== 1 ? "s" : ""} in cart
</span>
<button
type="button"
onClick={() =>
drafts.length >= 2
? setPhase("cart")
: setPhase("quick-add")
}
className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
>
{drafts.length >= 2 ? "Review Cart" : "Add More"}
<ChevronRight className="h-4 w-4" />
</button>
</div>
</div>
</div>
)}
</div>
)}

{/* Phase: Quick Add */}
{phase === "quick-add" && (
<div className="space-y-6">
<div className="flex items-center gap-3">
<button
type="button"
onClick={() => setPhase("create")}
className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
>
<ArrowLeft className="h-5 w-5" />
</button>
<div>
<h2 className="text-2xl font-bold text-slate-900">
Quick Add Thursdays
</h2>
<p className="mt-1 text-slate-500">
Batch-add recurring rehearsal dates to your draft cart
</p>
</div>
</div>

<QuickAddBuilder
existingDraftDates={draftDates}
onAddDrafts={(newDrafts) => {
handleAddDrafts(newDrafts);
setPhase("cart");
}}
/>
</div>
)}

{/* Phase: Cart */}
{phase === "cart" && (
<div className="space-y-6">
<div className="flex items-center gap-3">
<button
type="button"
onClick={() => setPhase("create")}
className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
>
<ArrowLeft className="h-5 w-5" />
</button>
<div>
<h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
Draft Cart
<span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 text-sm font-bold text-white">
{drafts.length}
</span>
</h2>
<p className="mt-1 text-slate-500">
Review and publish your draft events
</p>
</div>
</div>

{drafts.length === 0 ? (
<div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
<ShoppingCart className="mx-auto mb-3 h-12 w-12 text-slate-300" />
<p className="text-lg font-medium text-slate-600">
Your cart is empty
</p>
<p className="mt-1 text-sm text-slate-400">
Save events as drafts to add them here
</p>
<button
type="button"
onClick={() => setPhase("create")}
className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
>
Create Event
</button>
</div>
) : (
<DraftCartView
drafts={drafts}
onPublishSelected={handlePublishSelected}
onPublishAll={handlePublishAll}
onDelete={handleDeleteDraft}
/>
)}
</div>
)}

{/* Phase: Success */}
{phase === "success" && (
<SuccessView count={publishCount} onReset={handleReset} />
)}
</main>

{/* Publish Confirmation Modal */}
{phase === "confirm" && (
<PublishModal
drafts={drafts}
onConfirm={handleConfirmPublish}
onCancel={() => setPhase("cart")}
/>
)}
</div>
);
}
