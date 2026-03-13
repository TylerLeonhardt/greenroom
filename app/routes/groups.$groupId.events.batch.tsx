import type { MetaFunction } from "@remix-run/node";
import { Link, useParams } from "@remix-run/react";
import { ArrowLeft, ArrowRight, Calendar, Check, MapPin, Clock, Plus, X } from "lucide-react";
import { useState } from "react";

export const meta: MetaFunction = () => {
	return [{ title: "Batch Create Events — My Call Time" }];
};

interface EventRow {
	id: string;
	date: string;
	startTime: string;
	endTime: string;
	location: string;
}

export default function BatchCreateEvents() {
	const { groupId } = useParams();
	const userTimezone = "America/Chicago";

	// State management
	const [step, setStep] = useState(1);
	const [title, setTitle] = useState("Thursday Rehearsal");
	const [description, setDescription] = useState("");
	const [eventType, setEventType] = useState<"rehearsal" | "show" | "other">("rehearsal");
	const [defaultStartTime, setDefaultStartTime] = useState("19:00");
	const [defaultEndTime, setDefaultEndTime] = useState("21:00");
	const [defaultLocation, setDefaultLocation] = useState("Studio A - Main Space");
	const [timezone, setTimezone] = useState(userTimezone ?? "America/Los_Angeles");

	// Pre-populate with 12 Thursday rehearsals
	const [eventRows, setEventRows] = useState<EventRow[]>(() => {
		const rows: EventRow[] = [];
		const startDate = new Date();
		// Find next Thursday
		const daysUntilThursday = (4 - startDate.getDay() + 7) % 7 || 7;
		startDate.setDate(startDate.getDate() + daysUntilThursday);

		const locations = [
			"Studio A - Main Space",
			"Studio B - Black Box",
			"Studio A - Main Space",
			"Community Center - Room 201",
			"Studio A - Main Space",
			"Studio B - Black Box",
			"Studio A - Main Space",
			"Studio A - Main Space",
			"Studio B - Black Box",
			"Community Center - Room 201",
			"Studio A - Main Space",
			"Studio A - Main Space",
		];

		for (let i = 0; i < 12; i++) {
			const date = new Date(startDate);
			date.setDate(date.getDate() + i * 7);
			rows.push({
				id: `row-${i}`,
				date: date.toISOString().split("T")[0],
				startTime: "19:00",
				endTime: "21:00",
				location: locations[i] ?? "Studio A - Main Space",
			});
		}
		return rows;
	});

	const [showSuccess, setShowSuccess] = useState(false);

	const addRow = () => {
		const lastRow = eventRows[eventRows.length - 1];
		const nextDate = lastRow
			? new Date(new Date(lastRow.date).getTime() + 7 * 24 * 60 * 60 * 1000)
					.toISOString()
					.split("T")[0]
			: new Date().toISOString().split("T")[0];

		setEventRows([
			...eventRows,
			{
				id: `row-${Date.now()}`,
				date: nextDate,
				startTime: defaultStartTime,
				endTime: defaultEndTime,
				location: defaultLocation,
			},
		]);
	};

	const removeRow = (id: string) => {
		setEventRows(eventRows.filter((row) => row.id !== id));
	};

	const updateRow = (id: string, field: keyof EventRow, value: string) => {
		setEventRows(
			eventRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
		);
	};

	const handleNext = () => {
		if (step === 3) {
			// Simulate creation
			setShowSuccess(true);
			setTimeout(() => {
				setStep(4);
			}, 1000);
		} else {
			setStep(step + 1);
		}
	};

	const handleBack = () => {
		setStep(step - 1);
	};

	const formatDateDisplay = (dateStr: string) => {
		const date = new Date(dateStr + "T00:00:00");
		return date.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const getEventTypeEmoji = () => {
		switch (eventType) {
			case "show":
				return "🎭";
			case "rehearsal":
				return "🎯";
			default:
				return "📅";
		}
	};

	return (
		<div className="mx-auto max-w-4xl">
			{/* Header */}
			<div className="mb-6">
				<Link
					to={`/groups/${groupId}/events`}
					className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Events
				</Link>
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-slate-900">Batch Create Events</h1>
						<p className="mt-1 text-sm text-slate-600">
							Create multiple events at once with one notification
						</p>
					</div>
				</div>
			</div>

			{/* Step Indicator */}
			<div className="mb-8 flex items-center justify-center gap-2">
				{[1, 2, 3, 4].map((s) => (
					<div key={s} className="flex items-center">
						<div
							className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
								s === step
									? "border-emerald-600 bg-emerald-600 text-white"
									: s < step
										? "border-emerald-600 bg-emerald-50 text-emerald-600"
										: "border-slate-200 bg-white text-slate-400"
							}`}
						>
							{s < step ? <Check className="h-5 w-5" /> : s}
						</div>
						{s < 4 && (
							<div
								className={`mx-2 h-0.5 w-12 ${s < step ? "bg-emerald-600" : "bg-slate-200"}`}
							/>
						)}
					</div>
				))}
			</div>

			{/* Step Content */}
			<div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
				{/* Step 1: Shared Details */}
				{step === 1 && (
					<div className="space-y-6">
						<div>
							<h2 className="mb-4 text-xl font-bold text-slate-900">
								Step 1: Shared Details
							</h2>
							<p className="text-sm text-slate-600">
								These details will apply to all events (you can customize per event in the
								next step)
							</p>
						</div>

						<div>
							<label className="mb-1.5 block text-sm font-medium text-slate-700">
								Event Title <span className="text-red-500">*</span>
							</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="e.g., Thursday Rehearsal"
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>

						<div>
							<label className="mb-1.5 block text-sm font-medium text-slate-700">
								Event Type <span className="text-red-500">*</span>
							</label>
							<select
								value={eventType}
								onChange={(e) =>
									setEventType(e.target.value as "rehearsal" | "show" | "other")
								}
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							>
								<option value="rehearsal">🎯 Rehearsal</option>
								<option value="show">🎭 Show</option>
								<option value="other">📅 Other</option>
							</select>
						</div>

						<div>
							<label className="mb-1.5 block text-sm font-medium text-slate-700">
								Description (Optional)
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Add any details that apply to all these events..."
								rows={3}
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="mb-1.5 block text-sm font-medium text-slate-700">
									Default Start Time <span className="text-red-500">*</span>
								</label>
								<input
									type="time"
									value={defaultStartTime}
									onChange={(e) => setDefaultStartTime(e.target.value)}
									className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								/>
							</div>
							<div>
								<label className="mb-1.5 block text-sm font-medium text-slate-700">
									Default End Time <span className="text-red-500">*</span>
								</label>
								<input
									type="time"
									value={defaultEndTime}
									onChange={(e) => setDefaultEndTime(e.target.value)}
									className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								/>
							</div>
						</div>

						<div>
							<label className="mb-1.5 block text-sm font-medium text-slate-700">
								Default Location (Optional)
							</label>
							<input
								type="text"
								value={defaultLocation}
								onChange={(e) => setDefaultLocation(e.target.value)}
								placeholder="e.g., Studio A"
								className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
						</div>

						<div>
							<label className="mb-1.5 block text-sm font-medium text-slate-700">
								Timezone
							</label>
							<input
								type="text"
								value={timezone}
								readOnly
								className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
							/>
						</div>
					</div>
				)}

				{/* Step 2: Add Dates */}
				{step === 2 && (
					<div className="space-y-6">
						<div>
							<h2 className="mb-4 text-xl font-bold text-slate-900">
								Step 2: Select Dates
							</h2>
							<p className="text-sm text-slate-600">
								Choose the dates for your events and customize times/locations as needed
							</p>
						</div>

						<div className="space-y-3">
							{eventRows.map((row, idx) => (
								<div
									key={row.id}
									className="grid grid-cols-12 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
								>
									<div className="col-span-3">
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Date
										</label>
										<input
											type="date"
											value={row.date}
											onChange={(e) => updateRow(row.id, "date", e.target.value)}
											className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
										/>
									</div>
									<div className="col-span-2">
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Start
										</label>
										<input
											type="time"
											value={row.startTime}
											onChange={(e) => updateRow(row.id, "startTime", e.target.value)}
											className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
										/>
									</div>
									<div className="col-span-2">
										<label className="mb-1 block text-xs font-medium text-slate-600">
											End
										</label>
										<input
											type="time"
											value={row.endTime}
											onChange={(e) => updateRow(row.id, "endTime", e.target.value)}
											className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
										/>
									</div>
									<div className="col-span-4">
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Location
										</label>
										<input
											type="text"
											value={row.location}
											onChange={(e) => updateRow(row.id, "location", e.target.value)}
											placeholder="Location"
											className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
										/>
									</div>
									<div className="col-span-1 flex items-end">
										<button
											type="button"
											onClick={() => removeRow(row.id)}
											className="rounded-md p-1.5 text-red-500 hover:bg-red-50 transition-colors"
											title="Remove"
										>
											<X className="h-4 w-4" />
										</button>
									</div>
								</div>
							))}
						</div>

						<button
							type="button"
							onClick={addRow}
							className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-emerald-600 hover:text-emerald-600"
						>
							<Plus className="h-4 w-4" />
							Add Another Date
						</button>

						<div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
							<p className="text-sm text-blue-700">
								<strong>Tip:</strong> In the full version, you could import dates from an
								availability request or use quick shortcuts like "Every Thursday for 8
								weeks"
							</p>
						</div>
					</div>
				)}

				{/* Step 3: Review */}
				{step === 3 && (
					<div className="space-y-6">
						<div>
							<h2 className="mb-4 text-xl font-bold text-slate-900">Step 3: Review</h2>
							<p className="text-sm text-slate-600">
								Review all events before creating. You can edit any details inline.
							</p>
						</div>

						<div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-emerald-900">
										Ready to create {eventRows.length} events
									</p>
									<p className="mt-0.5 text-xs text-emerald-700">
										1 consolidated email notification will be sent to members
									</p>
								</div>
								<div className="text-2xl font-bold text-emerald-700">
									{eventRows.length}
								</div>
							</div>
						</div>

						<div className="space-y-2">
							{eventRows.map((row, idx) => (
								<div
									key={row.id}
									className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4"
								>
									<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xl">
										{getEventTypeEmoji()}
									</div>
									<div className="flex-1">
										<div className="font-semibold text-slate-900">{title}</div>
										<div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
											<span className="inline-flex items-center gap-1">
												<Calendar className="h-3 w-3" />
												{formatDateDisplay(row.date)}
											</span>
											<span className="inline-flex items-center gap-1">
												<Clock className="h-3 w-3" />
												{row.startTime} - {row.endTime}
											</span>
											{row.location && (
												<span className="inline-flex items-center gap-1">
													<MapPin className="h-3 w-3" />
													{row.location}
												</span>
											)}
										</div>
									</div>
								</div>
							))}
						</div>

						{showSuccess && (
							<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50">
								<div className="rounded-xl bg-white p-8 shadow-2xl">
									<div className="flex flex-col items-center gap-4">
										<div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
											<div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
										</div>
										<p className="text-lg font-semibold text-slate-900">
											Creating {eventRows.length} events...
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Step 4: Success */}
				{step === 4 && (
					<div className="space-y-6 text-center">
						<div className="flex justify-center">
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
								<Check className="h-12 w-12 text-emerald-600" />
							</div>
						</div>

						<div>
							<h2 className="mb-2 text-2xl font-bold text-slate-900">All Set!</h2>
							<p className="text-slate-600">
								Successfully created {eventRows.length} events.
							</p>
							<p className="mt-1 text-sm text-slate-500">
								1 notification email has been sent to group members.
							</p>
						</div>

						<div className="flex justify-center gap-3">
							<Link
								to={`/groups/${groupId}/events`}
								className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
							>
								View All Events
							</Link>
							<button
								type="button"
								onClick={() => {
									setStep(1);
									setShowSuccess(false);
								}}
								className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
							>
								Create More Events
							</button>
						</div>
					</div>
				)}

				{/* Navigation Buttons */}
				{step < 4 && (
					<div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
						<button
							type="button"
							onClick={handleBack}
							disabled={step === 1}
							className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<ArrowLeft className="h-4 w-4" />
							Back
						</button>

						<div className="text-sm text-slate-500">
							Step {step} of 4
						</div>

						<button
							type="button"
							onClick={handleNext}
							disabled={step === 1 && !title.trim()}
							className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{step === 3 ? "Create Events" : "Next"}
							<ArrowRight className="h-4 w-4" />
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
