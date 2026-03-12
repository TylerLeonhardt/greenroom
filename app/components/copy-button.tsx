import { Check, Copy } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

function useCopyState(value: string) {
	const [copied, setCopied] = useState(false);
	const [animating, setAnimating] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setAnimating(true);
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API unavailable in this context
		}
	}, [value]);

	const handleAnimationEnd = useCallback(() => {
		setAnimating(false);
	}, []);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	return { copied, animating, handleCopy, handleAnimationEnd };
}

/**
 * Small icon-only copy button (e.g., next to an invite code).
 * Shows a clipboard icon that swaps to a checkmark on success.
 */
export function CopyIconButton({ value, title = "Copy" }: { value: string; title?: string }) {
	const { copied, animating, handleCopy, handleAnimationEnd } = useCopyState(value);

	return (
		<button
			type="button"
			onClick={handleCopy}
			onAnimationEnd={handleAnimationEnd}
			className={`rounded-lg border p-2 transition-all duration-200 ${
				copied
					? "border-emerald-300 bg-emerald-50 text-emerald-600"
					: "border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
			} ${animating ? "animate-copy-success" : ""}`}
			title={copied ? "Copied!" : title}
			aria-label={copied ? "Copied!" : title}
		>
			{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
		</button>
	);
}

/**
 * Text copy button with a label that swaps to "Copied!" on success.
 * Pass additional layout classes (e.g., `w-full`, `mt-3`) via `className`.
 */
export function CopyButton({
	value,
	children,
	className = "",
}: {
	value: string;
	children: ReactNode;
	className?: string;
}) {
	const { copied, animating, handleCopy, handleAnimationEnd } = useCopyState(value);

	return (
		<button
			type="button"
			onClick={handleCopy}
			onAnimationEnd={handleAnimationEnd}
			className={`rounded-lg border transition-all duration-200 ${
				copied
					? "border-emerald-300 bg-emerald-50 text-emerald-600"
					: "border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-700"
			} ${animating ? "animate-copy-success" : ""} ${className}`}
		>
			{copied ? (
				<span className="inline-flex items-center justify-center gap-1.5">
					<Check className="h-3.5 w-3.5" />
					Copied!
				</span>
			) : (
				children
			)}
		</button>
	);
}
