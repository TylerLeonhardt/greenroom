const EVENT_TYPES = [
	{
		value: "rehearsal",
		label: "🎯 Rehearsal",
		color:
			"peer-checked:bg-emerald-100 peer-checked:border-emerald-300 peer-checked:text-emerald-800",
	},
	{
		value: "show",
		label: "🎭 Show",
		color: "peer-checked:bg-purple-100 peer-checked:border-purple-300 peer-checked:text-purple-800",
	},
	{
		value: "other",
		label: "📅 Other",
		color: "peer-checked:bg-slate-200 peer-checked:border-slate-400 peer-checked:text-slate-800",
	},
] as const;

export function EventTypeSelector({
	defaultValue = "rehearsal",
	onChange,
}: {
	defaultValue?: string;
	onChange?: (value: string) => void;
}) {
	return (
		<div className="flex flex-wrap gap-3">
			{EVENT_TYPES.map((type) => (
				<label key={type.value} className="cursor-pointer">
					<input
						type="radio"
						name="eventType"
						value={type.value}
						defaultChecked={type.value === defaultValue}
						onChange={() => onChange?.(type.value)}
						className="peer sr-only"
					/>
					<span
						className={`inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 ${type.color}`}
					>
						{type.label}
					</span>
				</label>
			))}
		</div>
	);
}
