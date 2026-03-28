import type { ReactNode } from "react";

interface DangerZoneCompactProps {
	variant?: "compact";
	description: string;
	children: ReactNode;
}

interface DangerZoneCardProps {
	variant: "card";
	description: string;
	children: ReactNode;
	icon?: ReactNode;
	subtitle?: string;
}

type DangerZoneProps = DangerZoneCompactProps | DangerZoneCardProps;

export function DangerZone(props: DangerZoneProps) {
	if (props.variant === "card") {
		return (
			<div className="rounded-xl border border-red-300 bg-white shadow-sm">
				<div className="border-b border-red-200 px-6 py-4">
					<h2 className="flex items-center gap-2 text-lg font-semibold text-red-600">
						{props.icon}
						Danger Zone
					</h2>
				</div>
				<div className="p-6">
					{props.subtitle && (
						<h3 className="text-sm font-semibold text-slate-900">{props.subtitle}</h3>
					)}
					<p className="mt-2 text-sm text-slate-600">{props.description}</p>
					<div className="mt-4">{props.children}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-red-200 bg-red-50 p-6">
			<h3 className="text-sm font-semibold text-red-900">Danger Zone</h3>
			<p className="mt-1 text-xs text-red-700">{props.description}</p>
			<div className="mt-4">{props.children}</div>
		</div>
	);
}
