const COLOR_SCHEMES = {
	emerald: {
		selected: "border-emerald-400 bg-emerald-100 text-emerald-800",
		unselected: "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50",
	},
	amber: {
		selected: "border-amber-400 bg-amber-100 text-amber-800",
		unselected: "border-slate-200 bg-white text-slate-700 hover:bg-amber-50",
	},
	red: {
		selected: "border-red-400 bg-red-100 text-red-800",
		unselected: "border-slate-200 bg-white text-slate-500 hover:bg-slate-100",
	},
	purple: {
		selected: "border-purple-400 bg-purple-100 text-purple-800",
		unselected: "border-slate-200 bg-white text-slate-700 hover:bg-purple-50",
	},
	slate: {
		selected: "border-slate-400 bg-slate-200 text-slate-800",
		unselected: "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
	},
} as const;

export type ChipColorScheme = keyof typeof COLOR_SCHEMES;

export function UserChipSelector({
	users,
	selectedIds,
	onToggle,
	colorScheme,
	dimmed,
}: {
	users: Array<{ id: string; name: string }>;
	selectedIds: Set<string>;
	onToggle: (id: string) => void;
	colorScheme: ChipColorScheme;
	dimmed?: boolean;
}) {
	const colors = COLOR_SCHEMES[colorScheme];
	return (
		<div className="flex flex-wrap gap-2">
			{users.map((user) => (
				<label
					key={user.id}
					className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
						selectedIds.has(user.id) ? colors.selected : colors.unselected
					}${dimmed ? " opacity-60" : ""}`}
				>
					<input
						type="checkbox"
						className="sr-only"
						checked={selectedIds.has(user.id)}
						onChange={() => onToggle(user.id)}
					/>
					{user.name}
				</label>
			))}
		</div>
	);
}
