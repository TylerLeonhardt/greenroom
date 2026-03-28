import { Clock } from "lucide-react";
import { InlineTimezoneSelector } from "./timezone-selector";

export function EventDateTimeInputs({
	defaultDate = "",
	defaultStartTime = "19:00",
	defaultEndTime = "21:00",
	defaultCallTime = "18:00",
	timezone,
	onTimezoneChange,
	isShow,
}: {
	defaultDate?: string;
	defaultStartTime?: string;
	defaultEndTime?: string;
	defaultCallTime?: string;
	timezone: string;
	onTimezoneChange: (tz: string) => void;
	isShow: boolean;
}) {
	return (
		<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h3 className="mb-4 text-sm font-semibold text-slate-900">Date & Time</h3>
			<div className="mb-4">
				<InlineTimezoneSelector timezone={timezone} onChange={onTimezoneChange} />
				<input type="hidden" name="timezone" value={timezone} />
			</div>
			<div className="grid gap-4 sm:grid-cols-3">
				<div>
					<label htmlFor="date" className="block text-sm font-medium text-slate-700">
						Date <span className="text-red-500">*</span>
					</label>
					<input
						id="date"
						name="date"
						type="date"
						required
						defaultValue={defaultDate}
						className="mt-1 block w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
					/>
				</div>
				<div>
					<label htmlFor="startTime" className="block text-sm font-medium text-slate-700">
						Start Time <span className="text-red-500">*</span>
					</label>
					<input
						id="startTime"
						name="startTime"
						type="time"
						required
						defaultValue={defaultStartTime}
						className="mt-1 block w-full min-w-0 appearance-none rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
					/>
				</div>
				<div>
					<label htmlFor="endTime" className="block text-sm font-medium text-slate-700">
						End Time <span className="text-red-500">*</span>
					</label>
					<input
						id="endTime"
						name="endTime"
						type="time"
						required
						defaultValue={defaultEndTime}
						className="mt-1 block w-full min-w-0 appearance-none rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
					/>
				</div>
			</div>

			{isShow && (
				<div className="mt-4">
					<label htmlFor="callTime" className="block text-sm font-medium text-slate-700">
						<Clock className="mr-1 inline h-4 w-4 text-purple-500" />
						Call Time
						<span className="ml-1 text-xs font-normal text-slate-500">
							(when performers need to arrive)
						</span>
					</label>
					<input
						id="callTime"
						name="callTime"
						type="time"
						defaultValue={defaultCallTime}
						className="mt-1 block w-full min-w-0 appearance-none rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm transition-colors sm:max-w-[200px] focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
					/>
				</div>
			)}
		</div>
	);
}
