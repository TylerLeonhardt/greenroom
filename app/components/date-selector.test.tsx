// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateSelector } from "~/components/date-selector";

describe("DateSelector", () => {
	// March 2026: Sun=1st, Mon=2nd, ..., Sat=7th, Sun=8th, ..., Sat=28th, Sun=29th, Mon=30th, Tue=31st
	// Week 1: Sun 1, Mon 2, Tue 3, Wed 4, Thu 5, Fri 6, Sat 7
	// Week 2: Sun 8, Mon 9, ... Sat 14
	// Week 3: Sun 15, Mon 16, ... Sat 21
	// Week 4: Sun 22, Mon 23, ... Sat 28
	// Week 5: Sun 29, Mon 30, Tue 31
	const startDate = "2026-03-01";
	const endDate = "2026-03-31";

	describe("quick-select buttons", () => {
		it("renders all four quick-select buttons", () => {
			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={[]}
					onChange={() => {}}
				/>,
			);

			expect(screen.getByText("Weekdays (Mon–Fri)")).toBeDefined();
			expect(screen.getByText("Weekends (Sat–Sun)")).toBeDefined();
			expect(screen.getByText("All Days")).toBeDefined();
			expect(screen.getByText("Clear All")).toBeDefined();
		});

		it("selects only weekdays (Mon–Fri) when Weekdays button is clicked", async () => {
			const onChange = vi.fn();
			const user = userEvent.setup();

			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={[]}
					onChange={onChange}
				/>,
			);

			await user.click(screen.getByText("Weekdays (Mon–Fri)"));

			expect(onChange).toHaveBeenCalledOnce();
			const selected: string[] = onChange.mock.calls[0][0];

			// March 2026 has 22 weekdays (31 days - 9 weekend days)
			// Saturdays: 7, 14, 21, 28 (4 days)
			// Sundays: 1, 8, 15, 22, 29 (5 days)
			expect(selected).toHaveLength(22);

			// Verify no weekends are included
			for (const date of selected) {
				const day = new Date(`${date}T00:00:00`).getDay();
				expect(day).not.toBe(0); // not Sunday
				expect(day).not.toBe(6); // not Saturday
			}
		});

		it("selects only weekends (Sat–Sun) when Weekends button is clicked", async () => {
			const onChange = vi.fn();
			const user = userEvent.setup();

			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={[]}
					onChange={onChange}
				/>,
			);

			await user.click(screen.getByText("Weekends (Sat–Sun)"));

			expect(onChange).toHaveBeenCalledOnce();
			const selected: string[] = onChange.mock.calls[0][0];

			// March 2026: Sat 7,14,21,28 + Sun 1,8,15,22,29 = 9 weekend days
			expect(selected).toHaveLength(9);

			// Verify all are weekends
			for (const date of selected) {
				const day = new Date(`${date}T00:00:00`).getDay();
				expect(day === 0 || day === 6).toBe(true);
			}
		});

		it("weekdays + weekends = all days", async () => {
			const weekdaysCb = vi.fn();
			const weekendsCb = vi.fn();
			const user = userEvent.setup();

			const { rerender } = render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={[]}
					onChange={weekdaysCb}
				/>,
			);

			await user.click(screen.getByText("Weekdays (Mon–Fri)"));
			const weekdays: string[] = weekdaysCb.mock.calls[0][0];

			rerender(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={[]}
					onChange={weekendsCb}
				/>,
			);

			await user.click(screen.getByText("Weekends (Sat–Sun)"));
			const weekends: string[] = weekendsCb.mock.calls[0][0];

			// Together they should cover all 31 days with no overlap
			const allDates = new Set([...weekdays, ...weekends]);
			expect(allDates.size).toBe(31);
			expect(weekdays.length + weekends.length).toBe(31);
		});

		it("selects all days when All Days button is clicked", async () => {
			const onChange = vi.fn();
			const user = userEvent.setup();

			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={[]}
					onChange={onChange}
				/>,
			);

			await user.click(screen.getByText("All Days"));

			expect(onChange).toHaveBeenCalledOnce();
			const selected: string[] = onChange.mock.calls[0][0];
			expect(selected).toHaveLength(31);
		});

		it("clears all selected dates when Clear All is clicked", async () => {
			const onChange = vi.fn();
			const user = userEvent.setup();

			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={["2026-03-15", "2026-03-16"]}
					onChange={onChange}
				/>,
			);

			await user.click(screen.getByText("Clear All"));

			expect(onChange).toHaveBeenCalledOnce();
			expect(onChange.mock.calls[0][0]).toEqual([]);
		});
	});

	describe("selected count display", () => {
		it("shows '0 days selected' when none selected", () => {
			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={[]}
					onChange={() => {}}
				/>,
			);

			expect(screen.getByText("0 days selected")).toBeDefined();
		});

		it("shows '1 day selected' for singular", () => {
			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={["2026-03-15"]}
					onChange={() => {}}
				/>,
			);

			expect(screen.getByText("1 day selected")).toBeDefined();
		});

		it("shows '5 days selected' for plural", () => {
			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={["2026-03-15", "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19"]}
					onChange={() => {}}
				/>,
			);

			expect(screen.getByText("5 days selected")).toBeDefined();
		});
	});

	describe("empty state", () => {
		it("shows placeholder when no date range is set", () => {
			render(<DateSelector startDate="" endDate="" selectedDates={[]} onChange={() => {}} />);

			expect(screen.getByText("Select a date range above to choose specific days")).toBeDefined();
		});
	});

	describe("date toggling", () => {
		it("adds a date when clicking an unselected day", async () => {
			const onChange = vi.fn();
			const user = userEvent.setup();

			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={[]}
					onChange={onChange}
				/>,
			);

			// Click on day 15
			const dayButtons = screen.getAllByRole("button").filter((btn) => btn.textContent === "15");
			await user.click(dayButtons[0]);

			expect(onChange).toHaveBeenCalledOnce();
			expect(onChange.mock.calls[0][0]).toContain("2026-03-15");
		});

		it("removes a date when clicking an already-selected day", async () => {
			const onChange = vi.fn();
			const user = userEvent.setup();

			render(
				<DateSelector
					startDate={startDate}
					endDate={endDate}
					selectedDates={["2026-03-15"]}
					onChange={onChange}
				/>,
			);

			const dayButtons = screen.getAllByRole("button").filter((btn) => btn.textContent === "15");
			await user.click(dayButtons[0]);

			expect(onChange).toHaveBeenCalledOnce();
			expect(onChange.mock.calls[0][0]).not.toContain("2026-03-15");
		});
	});

	describe("weekends button with partial range", () => {
		it("selects only weekends within a mid-week range", async () => {
			const onChange = vi.fn();
			const user = userEvent.setup();

			// March 2-8, 2026: Mon, Tue, Wed, Thu, Fri, Sat, Sun
			render(
				<DateSelector
					startDate="2026-03-02"
					endDate="2026-03-08"
					selectedDates={[]}
					onChange={onChange}
				/>,
			);

			await user.click(screen.getByText("Weekends (Sat–Sun)"));

			const selected: string[] = onChange.mock.calls[0][0];
			// Only Sat Mar 7 and Sun Mar 8 are weekends in this range
			expect(selected).toHaveLength(2);
			expect(selected).toContain("2026-03-07");
			expect(selected).toContain("2026-03-08");
		});

		it("returns empty array when range contains no weekends", async () => {
			const onChange = vi.fn();
			const user = userEvent.setup();

			// March 2-6, 2026: Mon-Fri only
			render(
				<DateSelector
					startDate="2026-03-02"
					endDate="2026-03-06"
					selectedDates={[]}
					onChange={onChange}
				/>,
			);

			await user.click(screen.getByText("Weekends (Sat–Sun)"));

			const selected: string[] = onChange.mock.calls[0][0];
			expect(selected).toHaveLength(0);
		});
	});
});
