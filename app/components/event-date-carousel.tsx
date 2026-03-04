import { Link } from "@remix-run/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeTimezone } from "~/lib/date-utils";

interface CarouselEvent {
	id: string;
	title: string;
	eventType: string;
	startTime: string | Date;
}

interface EventDateCarouselProps {
	events: CarouselEvent[];
	currentEventId: string;
	groupId: string;
	timezone?: string;
}

const EVENT_TYPE_STYLES: Record<string, { label: string; active: string; inactive: string }> = {
	show: {
		label: "Show",
		active: "bg-purple-200 text-purple-800",
		inactive: "bg-purple-100 text-purple-700",
	},
	rehearsal: {
		label: "Rehearsal",
		active: "bg-emerald-200 text-emerald-800",
		inactive: "bg-emerald-100 text-emerald-700",
	},
	other: {
		label: "Other",
		active: "bg-slate-200 text-slate-800",
		inactive: "bg-slate-100 text-slate-700",
	},
};

function formatCarouselDate(
	dateInput: string | Date,
	timezone?: string,
): { month: string; day: string; weekday: string } {
	const tz = sanitizeTimezone(timezone);
	const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	return {
		month: d.toLocaleDateString("en-US", { month: "short", timeZone: tz }).toUpperCase(),
		day: d.toLocaleDateString("en-US", { day: "numeric", timeZone: tz }),
		weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: tz }),
	};
}

export function EventDateCarousel({
	events,
	currentEventId,
	groupId,
	timezone,
}: EventDateCarouselProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const activeRef = useRef<HTMLAnchorElement>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	const updateScrollState = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setCanScrollLeft(el.scrollLeft > 1);
		setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
	}, []);

	useEffect(() => {
		// Center the active card on mount
		if (activeRef.current && scrollRef.current) {
			const container = scrollRef.current;
			const card = activeRef.current;
			const scrollLeft = card.offsetLeft - container.clientWidth / 2 + card.clientWidth / 2;
			container.scrollLeft = Math.max(0, scrollLeft);
		}
		updateScrollState();
	}, [updateScrollState]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.addEventListener("scroll", updateScrollState, { passive: true });
		window.addEventListener("resize", updateScrollState);
		return () => {
			el.removeEventListener("scroll", updateScrollState);
			window.removeEventListener("resize", updateScrollState);
		};
	}, [updateScrollState]);

	const scroll = (direction: "left" | "right") => {
		const el = scrollRef.current;
		if (!el) return;
		const amount = el.clientWidth * 0.6;
		el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowLeft") {
			e.preventDefault();
			scroll("left");
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			scroll("right");
		}
	};

	if (events.length <= 1) return null;

	return (
		<nav className="relative mb-6" onKeyDown={handleKeyDown} aria-label="Event date navigation">
			{/* Left arrow */}
			{canScrollLeft && (
				<button
					type="button"
					onClick={() => scroll("left")}
					className="absolute -left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1.5 shadow-md transition-colors hover:bg-slate-50"
					aria-label="Scroll left"
				>
					<ChevronLeft className="h-4 w-4 text-slate-600" />
				</button>
			)}

			{/* Scrollable container */}
			<div
				ref={scrollRef}
				className="scrollbar-hide flex gap-2 overflow-x-auto px-1 py-1"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				{events.map((event) => {
					const isActive = event.id === currentEventId;
					const { month, day, weekday } = formatCarouselDate(event.startTime, timezone);
					const typeStyle = EVENT_TYPE_STYLES[event.eventType] ?? EVENT_TYPE_STYLES.other;

					return (
						<Link
							key={event.id}
							ref={isActive ? activeRef : undefined}
							to={`/groups/${groupId}/events/${event.id}`}
							className={`flex min-w-[5rem] flex-shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 text-center transition-all ${
								isActive
									? "border-emerald-400 bg-emerald-50 shadow-sm ring-1 ring-emerald-200"
									: "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50"
							}`}
							aria-current={isActive ? "page" : undefined}
							preventScrollReset
						>
							<span
								className={`text-[10px] font-bold tracking-wider ${
									isActive ? "text-emerald-700" : "text-slate-400"
								}`}
							>
								{month}
							</span>
							<span
								className={`text-xl font-bold leading-tight ${
									isActive ? "text-emerald-800" : "text-slate-800"
								}`}
							>
								{day}
							</span>
							<span className={`text-[11px] ${isActive ? "text-emerald-600" : "text-slate-500"}`}>
								{weekday}
							</span>
							<span
								className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${
									isActive ? typeStyle.active : typeStyle.inactive
								}`}
							>
								{typeStyle.label}
							</span>
						</Link>
					);
				})}
			</div>

			{/* Right arrow */}
			{canScrollRight && (
				<button
					type="button"
					onClick={() => scroll("right")}
					className="absolute -right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1.5 shadow-md transition-colors hover:bg-slate-50"
					aria-label="Scroll right"
				>
					<ChevronRight className="h-4 w-4 text-slate-600" />
				</button>
			)}
		</nav>
	);
}
