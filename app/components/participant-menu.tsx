import { Form, useFetcher } from "@remix-run/react";
import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CsrfInput } from "~/components/csrf-input";

type MenuView = "menu" | "role";

interface ParticipantMenuProps {
	userId: string;
	currentRole: string | null;
	isShow: boolean;
	notifyOnRoleChange: boolean;
}

export function ParticipantMenu({
	userId,
	currentRole,
	isShow,
	notifyOnRoleChange,
}: ParticipantMenuProps) {
	const fetcher = useFetcher();
	const [isOpen, setIsOpen] = useState(false);
	const [view, setView] = useState<MenuView>("menu");
	const [showCustomInput, setShowCustomInput] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
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

	const close = useCallback(() => {
		setIsOpen(false);
		setView("menu");
		setShowCustomInput(false);
	}, []);

	// Click outside to close
	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				close();
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [isOpen, close]);

	// Auto-focus custom input when shown
	useEffect(() => {
		if (showCustomInput) {
			inputRef.current?.focus();
		}
	}, [showCustomInput]);

	const submitRole = (role: string) => {
		const trimmed = role.trim();
		if (!trimmed || trimmed === currentRole) {
			close();
			return;
		}
		if (trimmed.length > 100) return;
		if (roleInputRef.current && formRef.current) {
			roleInputRef.current.value = trimmed;
			fetcher.submit(formRef.current);
		}
		close();
	};

	const handleChangeRole = () => {
		if (!isShow) {
			setView("role");
			setShowCustomInput(true);
		} else {
			setView("role");
			setShowCustomInput(false);
		}
	};

	return (
		<div ref={menuRef} className="relative">
			{/* Hidden form for role change */}
			<fetcher.Form method="post" ref={formRef} className="hidden">
				<CsrfInput />
				<input type="hidden" name="intent" value="change-role" />
				<input type="hidden" name="userId" value={userId} />
				<input type="hidden" name="newRole" ref={roleInputRef} value="" />
				{notifyOnRoleChange && <input type="hidden" name="sendNotification" value="on" />}
			</fetcher.Form>

			{/* Three-dot trigger */}
			<button
				type="button"
				onClick={() => (isOpen ? close() : setIsOpen(true))}
				onKeyDown={(e) => {
					if (e.key === "Escape" && isOpen) {
						e.stopPropagation();
						close();
					}
				}}
				disabled={isUpdating}
				className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
				aria-label="Participant actions"
				aria-haspopup="menu"
				aria-expanded={isOpen}
			>
				<EllipsisVertical className="h-4 w-4" />
			</button>

			{/* Error feedback */}
			{fetcherError && <p className="absolute right-0 mt-1 text-xs text-red-600">{fetcherError}</p>}

			{/* Dropdown */}
			{isOpen && (
				<div
					role="menu"
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							e.stopPropagation();
							close();
						}
					}}
					className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
				>
					{view === "menu" && (
						<>
							<button
								type="button"
								role="menuitem"
								onClick={handleChangeRole}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
							>
								<Pencil className="h-3.5 w-3.5 text-slate-400" />
								Change Role…
							</button>
							<div className="border-t border-slate-100" />
							<Form method="post" onSubmit={close}>
								<CsrfInput />
								<input type="hidden" name="intent" value="remove-assignment" />
								<input type="hidden" name="userId" value={userId} />
								<button
									type="submit"
									role="menuitem"
									className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Remove
								</button>
							</Form>
						</>
					)}

					{view === "role" && !showCustomInput && (
						<>
							<button
								type="button"
								role="menuitem"
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
								role="menuitem"
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
								role="menuitem"
								onClick={() => setShowCustomInput(true)}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50"
							>
								<Pencil className="h-3.5 w-3.5" /> Custom role…
							</button>
						</>
					)}

					{view === "role" && showCustomInput && (
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
										close();
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
