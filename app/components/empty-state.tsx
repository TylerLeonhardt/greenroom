import type { ReactNode } from "react";

export function EmptyState({
	icon,
	title,
	description,
	actions,
}: {
	icon?: ReactNode;
	title?: string;
	description?: string;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
			{icon && <div className="text-3xl">{icon}</div>}
			{title && <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>}
			{description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
			{actions && <div className="mt-4 flex gap-3">{actions}</div>}
		</div>
	);
}
