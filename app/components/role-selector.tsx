import { useFetcher } from "@remix-run/react";
import { ChevronDown, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CsrfInput } from "~/components/csrf-input";

interface RoleSelectorProps {
	userId: string;
	currentRole: string | null;
	isShow: boolean;
	notifyOnRoleChange: boolean;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
	Performer: "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100",
	Viewer: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
};

const DEFAULT_BADGE_STYLE = "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100";

export function RoleSelector({
	userId,
	currentRole,
	isShow,
	notifyOnRoleChange,
}: RoleSelectorProps) {
	const fetcher = useFetcher();
	const [isOpen, setIsOpen] = useState(false);
	const [showCustomInput, setShowCustomInput] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const roleInputRef = useRef<HTMLInputElement>(null);

	const pendingRole = fetcher.formData?.get("newRole") as string | undefined;
	const fetcherError =
		fetcher.data && typeof fetcher.data === "object" && "error" in fetcher.data
			? (fetcher.data as { error: string }).error
			: null;
	const displayRole = fetcherError ? currentRole : (pendingRole ?? currentRole);
	const isUpdating = fetcher.state !== "idle";

	// Click outside to close
	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setIsOpen(false);
				setShowCustomInput(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [isOpen]);

	// Auto-focus custom input when shown
	useEffect(() => {
		if (showCustomInput) {
			inputRef.current?.focus();
		}
	}, [showCustomInput]);

	const submitRole = (role: string) => {
		const trimmed = role.trim();
		if (!trimmed || trimmed === currentRole) {
			setIsOpen(false);
			setShowCustomInput(false);
			return;
		}
		if (trimmed.length > 100) return;
		if (roleInputRef.current && formRef.current) {
			roleInputRef.current.value = trimmed;
			fetcher.submit(formRef.current);
		}
		setIsOpen(false);
		setShowCustomInput(false);
	};

	const handleBadgeClick = () => {
		if (isUpdating) return;
		if (!isShow) {
			// Non-show events: open custom input directly
			setShowCustomInput(true);
			setIsOpen(true);
		} else {
			setIsOpen(!isOpen);
			setShowCustomInput(false);
		}
	};

	const badgeStyle = ROLE_BADGE_STYLES[displayRole ?? ""] ?? DEFAULT_BADGE_STYLE;

	return (
		<div ref={dropdownRef} className="relative">
			{/* Hidden form for CSRF-safe submission */}
			<fetcher.Form method="post" ref={formRef} className="hidden">
				<CsrfInput />
				<input type="hidden" name="intent" value="change-role" />
				<input type="hidden" name="userId" value={userId} />
				<input type="hidden" name="newRole" ref={roleInputRef} value="" />
				{notifyOnRoleChange && <input type="hidden" name="sendNotification" value="on" />}
			</fetcher.Form>

			{/* Role badge button */}
			<button
				type="button"
				onClick={handleBadgeClick}
				disabled={isUpdating}
				className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${badgeStyle}`}
			>
				{displayRole ?? "Set role"}
				<ChevronDown className="h-3 w-3" />
			</button>

			{/* Server error feedback */}
			{fetcherError && <p className="mt-1 text-xs text-red-600">{fetcherError}</p>}

			{/* Dropdown */}
			{isOpen && (
				<div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
					{isShow && !showCustomInput && (
						<>
							<button
								type="button"
								onClick={() => submitRole("Performer")}
								className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-purple-50 ${
									displayRole === "Performer" ? "font-medium text-purple-700" : "text-slate-700"
								}`}
							>
								🎭 Performer
								{displayRole === "Performer" && <span className="ml-auto text-purple-500">✓</span>}
							</button>
							<button
								type="button"
								onClick={() => submitRole("Viewer")}
								className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-amber-50 ${
									displayRole === "Viewer" ? "font-medium text-amber-700" : "text-slate-700"
								}`}
							>
								👀 Viewer
								{displayRole === "Viewer" && <span className="ml-auto text-amber-500">✓</span>}
							</button>
							<div className="border-t border-slate-100" />
							<button
								type="button"
								onClick={() => setShowCustomInput(true)}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50"
							>
								<Pencil className="h-3.5 w-3.5" /> Custom role…
							</button>
						</>
					)}
					{showCustomInput && (
						<div className="p-2">
							<input
								ref={inputRef}
								type="text"
								placeholder="Type role name…"
								maxLength={100}
								defaultValue={
									displayRole && displayRole !== "Performer" && displayRole !== "Viewer"
										? displayRole
										: ""
								}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										submitRole(e.currentTarget.value);
									}
									if (e.key === "Escape") {
										setIsOpen(false);
										setShowCustomInput(false);
									}
								}}
								className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
							/>
							<p className="mt-1 text-xs text-slate-400">Press Enter to save, Esc to cancel</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** Read-only role badge for non-admin users */
export function RoleBadge({ role }: { role: string | null }) {
	if (!role) return null;
	const style = ROLE_BADGE_STYLES[role] ?? DEFAULT_BADGE_STYLE;
	return (
		<span
			className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
		>
			{role}
		</span>
	);
}
