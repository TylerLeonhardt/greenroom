// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResultsHeatmap } from "~/components/results-heatmap";

vi.mock("~/lib/date-utils", () => ({
	formatDateDisplay: vi.fn((date: string) => ({
		dayOfWeek: "Sat",
		display: date,
	})),
}));

interface DateResult {
	date: string;
	available: number;
	maybe: number;
	notAvailable: number;
	noResponse: number;
	total: number;
	score: number;
	respondents: Array<{ name: string; status: string }>;
}

function makeDateResult(overrides: Partial<DateResult> = {}): DateResult {
	return {
		date: "2025-03-15",
		available: 3,
		maybe: 1,
		notAvailable: 1,
		noResponse: 0,
		total: 5,
		score: 7,
		respondents: [
			{ name: "Alice", status: "available" },
			{ name: "Bob", status: "available" },
			{ name: "Carol", status: "available" },
			{ name: "Dave", status: "maybe" },
			{ name: "Eve", status: "not_available" },
		],
		...overrides,
	};
}

function makeThreeDates(): DateResult[] {
	return [
		makeDateResult({
			date: "2025-03-15",
			score: 7,
			respondents: [
				{ name: "Alice", status: "available" },
				{ name: "Bob", status: "maybe" },
			],
		}),
		makeDateResult({
			date: "2025-03-16",
			score: 5,
			respondents: [
				{ name: "Carol", status: "available" },
				{ name: "Dave", status: "not_available" },
			],
		}),
		makeDateResult({
			date: "2025-03-17",
			score: 3,
			respondents: [
				{ name: "Eve", status: "available" },
				{ name: "Frank", status: "maybe" },
			],
		}),
	];
}

const defaultProps = {
	totalMembers: 5,
	totalResponded: 4,
	groupId: "group-1",
	requestId: "req-1",
};

/** Get the desktop table wrapper element and scoped queries. */
function getDesktopTable(container: HTMLElement) {
	// The desktop wrapper has class "hidden sm:block"
	const el = container.querySelector(".hidden.sm\\:block") as HTMLElement;
	if (!el) throw new Error("Desktop table wrapper not found");
	return { ...within(el), el };
}

describe("ResultsHeatmap", () => {
	describe("basic rendering", () => {
		it("renders date rows", () => {
			const dates = makeThreeDates();
			const { container } = render(<ResultsHeatmap dates={dates} {...defaultProps} />);
			const desktop = getDesktopTable(container);
			// Each date row should appear in the desktop table
			expect(desktop.getByText("2025-03-15")).toBeDefined();
			expect(desktop.getByText("2025-03-16")).toBeDefined();
			expect(desktop.getByText("2025-03-17")).toBeDefined();
		});

		it("shows score badges", () => {
			const dates = makeThreeDates();
			const { container } = render(<ResultsHeatmap dates={dates} {...defaultProps} />);
			const desktop = getDesktopTable(container);
			// Score badges are in spans with specific classes
			const badges = desktop.el.querySelectorAll("span.inline-flex.items-center.rounded-full");
			const scores = Array.from(badges).map((b) => b.textContent);
			expect(scores).toEqual(["7", "5", "3"]);
		});

		it("shows star on top dates", () => {
			const dates = makeThreeDates();
			const { container } = render(<ResultsHeatmap dates={dates} {...defaultProps} />);
			const desktop = getDesktopTable(container);
			// Top 3 dates with score > 0 get a star. All three qualify here.
			// Stars render as SVGs with fill-amber-400 class inside the cell with the date text
			const stars = desktop.el.querySelectorAll(".fill-amber-400");
			expect(stars.length).toBeGreaterThanOrEqual(3);
		});

		it("shows time range when provided", () => {
			const dates = [makeDateResult()];
			render(<ResultsHeatmap dates={dates} {...defaultProps} timeRange="7:00 PM – 9:00 PM" />);
			expect(screen.getByText("7:00 PM – 9:00 PM")).toBeDefined();
		});
	});

	describe("multi-expand (#143)", () => {
		it("allows multiple dates to be expanded simultaneously", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const { container } = render(<ResultsHeatmap dates={dates} {...defaultProps} />);
			const desktop = getDesktopTable(container);

			// Click the caret cell for date 1 (first row's caret td)
			const caretCells =
				desktop.el.querySelectorAll<HTMLTableCellElement>("tbody tr td:first-child");
			// The caret cells are the first <td> in each data row
			await user.click(caretCells[0]);
			await user.click(caretCells[1]);

			// Both dates' respondents should be visible
			expect(desktop.getByText("Alice")).toBeDefined();
			expect(desktop.getByText("Bob")).toBeDefined();
			expect(desktop.getByText("Carol")).toBeDefined();
			expect(desktop.getByText("Dave")).toBeDefined();
		});

		it("collapsing one date does not affect other expanded dates", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const { container } = render(<ResultsHeatmap dates={dates} {...defaultProps} />);
			const desktop = getDesktopTable(container);

			const caretCells =
				desktop.el.querySelectorAll<HTMLTableCellElement>("tbody tr td:first-child");

			// Expand date 1 and date 2
			await user.click(caretCells[0]);
			await user.click(caretCells[1]);

			// Verify both are expanded
			expect(desktop.getByText("Alice")).toBeDefined();
			expect(desktop.getByText("Carol")).toBeDefined();

			// Collapse date 1 by clicking its caret again
			// After expanding, a detail row is inserted after each expanded row.
			// Re-query carets: rows are now [row0, detail0, row1, detail1, row2]
			const updatedCarets =
				desktop.el.querySelectorAll<HTMLTableCellElement>("tbody tr td:first-child");
			await user.click(updatedCarets[0]);

			// Date 1 respondents gone, date 2 respondents still visible
			expect(desktop.queryByText("Alice")).toBeNull();
			expect(desktop.getByText("Carol")).toBeDefined();
			expect(desktop.getByText("Dave")).toBeDefined();
		});

		it("shows respondents for all expanded dates", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const { container } = render(<ResultsHeatmap dates={dates} {...defaultProps} />);
			const desktop = getDesktopTable(container);

			// Expand all three dates via caret cells
			const caretCells =
				desktop.el.querySelectorAll<HTMLTableCellElement>("tbody tr td:first-child");
			await user.click(caretCells[0]);
			await user.click(caretCells[1]);
			await user.click(caretCells[2]);

			// All respondents from all three dates should be visible
			expect(desktop.getByText("Alice")).toBeDefined();
			expect(desktop.getByText("Bob")).toBeDefined();
			expect(desktop.getByText("Carol")).toBeDefined();
			expect(desktop.getByText("Dave")).toBeDefined();
			expect(desktop.getByText("Eve")).toBeDefined();
			expect(desktop.getByText("Frank")).toBeDefined();
		});
	});

	describe("batch mode expansion (#144)", () => {
		it("allows expanding a date row via caret while in batch selection mode", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const onBatchCreate = vi.fn();
			const { container } = render(
				<ResultsHeatmap
					dates={dates}
					{...defaultProps}
					batchMode={true}
					onBatchCreate={onBatchCreate}
				/>,
			);

			// Enter batch selecting mode
			await user.click(screen.getByText("Select Dates"));
			const desktop = getDesktopTable(container);

			// In batch mode, the first td is the checkbox, the second is the caret.
			// Click the caret button inside the second td to expand — not the row or checkbox.
			const rows = desktop.el.querySelectorAll<HTMLTableRowElement>("tbody tr");
			const caretButton = rows[0].querySelectorAll("td")[1].querySelector("button");
			expect(caretButton).not.toBeNull();
			await user.click(caretButton!);

			// Respondents should be visible (expansion happened)
			expect(desktop.getByText("Alice")).toBeDefined();
			expect(desktop.getByText("Bob")).toBeDefined();
		});

		it("caret click does not toggle date selection", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const onBatchCreate = vi.fn();
			const { container } = render(
				<ResultsHeatmap
					dates={dates}
					{...defaultProps}
					batchMode={true}
					onBatchCreate={onBatchCreate}
				/>,
			);

			await user.click(screen.getByText("Select Dates"));
			const desktop = getDesktopTable(container);

			// Click caret button on first row
			const rows = desktop.el.querySelectorAll<HTMLTableRowElement>("tbody tr");
			const caretButton = rows[0].querySelectorAll("td")[1].querySelector("button");
			expect(caretButton).not.toBeNull();
			await user.click(caretButton!);

			// The date should NOT be selected (no "1 date selected" text)
			expect(screen.queryByText(/1 date/)).toBeNull();
		});

		it("checkbox click does not toggle expansion", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const onBatchCreate = vi.fn();
			const { container } = render(
				<ResultsHeatmap
					dates={dates}
					{...defaultProps}
					batchMode={true}
					onBatchCreate={onBatchCreate}
				/>,
			);

			await user.click(screen.getByText("Select Dates"));
			const desktop = getDesktopTable(container);

			// Click the checkbox button (inside first td) on the first row
			const rows = desktop.el.querySelectorAll<HTMLTableRowElement>("tbody tr");
			const checkboxButton = rows[0].querySelectorAll("td")[0].querySelector("button");
			expect(checkboxButton).not.toBeNull();
			await user.click(checkboxButton!);

			// Date should be selected but NOT expanded (no respondent names visible)
			expect(screen.queryByText("Alice")).toBeNull();
			expect(screen.getAllByText(/1 date/).length).toBeGreaterThan(0);
		});

		it("row click toggles selection in batch mode", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const onBatchCreate = vi.fn();
			const { container } = render(
				<ResultsHeatmap
					dates={dates}
					{...defaultProps}
					batchMode={true}
					onBatchCreate={onBatchCreate}
				/>,
			);

			await user.click(screen.getByText("Select Dates"));
			const desktop = getDesktopTable(container);

			// Click the row itself (not checkbox, not caret) — e.g. the date text cell
			const rows = desktop.el.querySelectorAll<HTMLTableRowElement>("tbody tr");
			// Click on the <tr> directly — the row onClick handler toggles selection
			await user.click(rows[0]);

			// Should show "1 date selected"
			expect(screen.getAllByText(/1 date/).length).toBeGreaterThan(0);

			// Click again to deselect
			// Re-query since DOM may have changed
			const updatedRows = desktop.el.querySelectorAll<HTMLTableRowElement>("tbody tr");
			await user.click(updatedRows[0]);
			expect(screen.queryByText(/1 date/)).toBeNull();
		});

		it("shows expanded content in batch mode on mobile", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const onBatchCreate = vi.fn();
			const { container } = render(
				<ResultsHeatmap
					dates={dates}
					{...defaultProps}
					batchMode={true}
					onBatchCreate={onBatchCreate}
				/>,
			);

			// Enter batch selecting mode
			await user.click(screen.getByText("Select Dates"));

			// Mobile cards are in div.sm\:hidden — get the mobile wrapper
			const mobileWrapper = container.querySelector(".sm\\:hidden");
			expect(mobileWrapper).not.toBeNull();
			const mobile = within(mobileWrapper as HTMLElement);

			// Mobile caret is a <button> with onClick that calls toggleExpanded.
			// The outer wrapper is now a div[role="button"], inner caret is a button.p-1
			const caretButtons = (mobileWrapper as HTMLElement).querySelectorAll<HTMLButtonElement>(
				"div[role='button'] button.p-1",
			);
			expect(caretButtons.length).toBeGreaterThan(0);
			await user.click(caretButtons[0]);

			// After clicking caret, respondents should be visible
			expect(mobile.getByText("Alice")).toBeDefined();
			expect(mobile.getByText("Bob")).toBeDefined();
		});
	});

	describe("batch selection", () => {
		it("shows Select Dates button when batchMode is true", () => {
			const dates = [makeDateResult()];
			render(
				<ResultsHeatmap dates={dates} {...defaultProps} batchMode={true} onBatchCreate={vi.fn()} />,
			);
			expect(screen.getByText("Select Dates")).toBeDefined();
		});

		it("toggles batch selecting mode", async () => {
			const user = userEvent.setup();
			const dates = [makeDateResult()];
			render(
				<ResultsHeatmap dates={dates} {...defaultProps} batchMode={true} onBatchCreate={vi.fn()} />,
			);

			// Initially shows "Select Dates"
			const btn = screen.getByText("Select Dates");
			await user.click(btn);

			// Now in batch selecting mode — button text changes to "Cancel Selection"
			expect(screen.getByText("Cancel Selection")).toBeDefined();

			// Click cancel to exit batch mode
			await user.click(screen.getByText("Cancel Selection"));
			expect(screen.getByText("Select Dates")).toBeDefined();
		});

		it("selects and deselects dates", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const onBatchCreate = vi.fn();
			const { container } = render(
				<ResultsHeatmap
					dates={dates}
					{...defaultProps}
					batchMode={true}
					onBatchCreate={onBatchCreate}
				/>,
			);

			await user.click(screen.getByText("Select Dates"));
			const desktop = getDesktopTable(container);

			// Click the row to select the first date
			const rows = desktop.el.querySelectorAll<HTMLTableRowElement>("tbody tr");
			await user.click(rows[0]);

			expect(screen.getAllByText(/1 date/).length).toBeGreaterThan(0);

			// Select second date
			await user.click(rows[1]);
			expect(screen.getAllByText(/2 dates/).length).toBeGreaterThan(0);

			// Deselect first — re-query due to DOM changes
			const updatedRows = desktop.el.querySelectorAll<HTMLTableRowElement>("tbody tr");
			await user.click(updatedRows[0]);
			expect(screen.getAllByText(/1 date/).length).toBeGreaterThan(0);
		});

		it("calls onBatchCreate with selected dates", async () => {
			const user = userEvent.setup();
			const dates = makeThreeDates();
			const onBatchCreate = vi.fn();
			const { container } = render(
				<ResultsHeatmap
					dates={dates}
					{...defaultProps}
					batchMode={true}
					onBatchCreate={onBatchCreate}
				/>,
			);

			await user.click(screen.getByText("Select Dates"));
			const desktop = getDesktopTable(container);

			// Select first two dates
			const rows = desktop.el.querySelectorAll<HTMLTableRowElement>("tbody tr");
			await user.click(rows[0]);
			await user.click(rows[1]);

			// Click the "Create 2 Events →" button
			const createBtn = screen.getAllByText(/Create 2 Events/)[0];
			await user.click(createBtn);

			expect(onBatchCreate).toHaveBeenCalledOnce();
			const calledWith = onBatchCreate.mock.calls[0][0] as string[];
			expect(calledWith.sort()).toEqual(["2025-03-15", "2025-03-16"]);
		});

		it("Select Top 5 selects the 5 highest-scoring dates", async () => {
			const user = userEvent.setup();
			// Create 7 dates with different scores
			const dates = [
				makeDateResult({ date: "2025-03-10", score: 2 }),
				makeDateResult({ date: "2025-03-11", score: 8 }),
				makeDateResult({ date: "2025-03-12", score: 5 }),
				makeDateResult({ date: "2025-03-13", score: 10 }),
				makeDateResult({ date: "2025-03-14", score: 1 }),
				makeDateResult({ date: "2025-03-15", score: 7 }),
				makeDateResult({ date: "2025-03-16", score: 9 }),
			];
			const onBatchCreate = vi.fn();
			render(
				<ResultsHeatmap
					dates={dates}
					{...defaultProps}
					batchMode={true}
					onBatchCreate={onBatchCreate}
				/>,
			);

			await user.click(screen.getByText("Select Dates"));
			await user.click(screen.getByText("Select Top 5"));

			// Should show "5 dates selected"
			expect(screen.getAllByText(/5 dates/).length).toBeGreaterThan(0);

			// Create events and verify which dates were picked
			const createBtn = screen.getAllByText(/Create 5 Events/)[0];
			await user.click(createBtn);

			const calledWith = (onBatchCreate.mock.calls[0][0] as string[]).sort();
			// Top 5 by score: 10 (03-13), 9 (03-16), 8 (03-11), 7 (03-15), 5 (03-12)
			expect(calledWith).toEqual([
				"2025-03-11",
				"2025-03-12",
				"2025-03-13",
				"2025-03-15",
				"2025-03-16",
			]);
		});
	});
});
