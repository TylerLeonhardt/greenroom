// @vitest-environment jsdom
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityGrid } from "~/components/availability-grid";

vi.mock("~/lib/date-utils", () => ({
	formatDateDisplay: vi.fn((date: string) => ({
		dayOfWeek: "Sat",
		display: date,
	})),
}));

const sampleDates = ["2025-03-15", "2025-03-16", "2025-03-17"];

function getDesktopTable(container: HTMLElement) {
	const el = container.querySelector(".hidden.sm\\:block") as HTMLElement;
	if (!el) throw new Error("Desktop table wrapper not found");
	return { ...within(el), el };
}

function getMobileCards(container: HTMLElement) {
	const el = container.querySelector(".sm\\:hidden") as HTMLElement;
	if (!el) throw new Error("Mobile cards wrapper not found");
	return { ...within(el), el };
}

describe("AvailabilityGrid notes", () => {
	describe("desktop table", () => {
		it("shows add note button when onNotesChange is provided", () => {
			const { container } = render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={{}}
					onChange={vi.fn()}
					notes={{}}
					onNotesChange={vi.fn()}
				/>,
			);
			const desktop = getDesktopTable(container);
			const noteButtons = desktop.el.querySelectorAll('button[title="Add note"]');
			expect(noteButtons.length).toBe(3);
		});

		it("does not show add note button when onNotesChange is not provided", () => {
			const { container } = render(
				<AvailabilityGrid dates={sampleDates} responses={{}} onChange={vi.fn()} />,
			);
			const desktop = getDesktopTable(container);
			const noteButtons = desktop.el.querySelectorAll('button[title="Add note"]');
			expect(noteButtons.length).toBe(0);
		});

		it("expands note input when add note button is clicked", async () => {
			const user = userEvent.setup();
			const { container } = render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={{}}
					onChange={vi.fn()}
					notes={{}}
					onNotesChange={vi.fn()}
				/>,
			);
			const desktop = getDesktopTable(container);
			const noteButtons = desktop.el.querySelectorAll('button[title="Add note"]');
			await user.click(noteButtons[0]);

			const input = desktop.el.querySelector('input[placeholder="Add a note..."]');
			expect(input).not.toBeNull();
		});

		it("calls onNotesChange when a note is typed", async () => {
			const user = userEvent.setup();
			const onNotesChange = vi.fn();
			const { container } = render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={{}}
					onChange={vi.fn()}
					notes={{}}
					onNotesChange={onNotesChange}
				/>,
			);
			const desktop = getDesktopTable(container);
			const noteButtons = desktop.el.querySelectorAll('button[title="Add note"]');
			await user.click(noteButtons[0]);

			const input = desktop.el.querySelector(
				'input[placeholder="Add a note..."]',
			) as HTMLInputElement;
			await user.type(input, "L");

			expect(onNotesChange).toHaveBeenCalledWith({ "2025-03-15": "L" });
		});

		it("auto-expands dates that already have notes", () => {
			const { container } = render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={{}}
					onChange={vi.fn()}
					notes={{ "2025-03-15": "Existing note" }}
					onNotesChange={vi.fn()}
				/>,
			);
			const desktop = getDesktopTable(container);
			const input = desktop.el.querySelector(
				'input[placeholder="Add a note..."]',
			) as HTMLInputElement;
			expect(input).not.toBeNull();
			expect(input.value).toBe("Existing note");
		});

		it("does not show note UI when disabled", () => {
			const { container } = render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={{}}
					onChange={vi.fn()}
					notes={{ "2025-03-15": "Read-only note" }}
					onNotesChange={vi.fn()}
					disabled
				/>,
			);
			const desktop = getDesktopTable(container);
			// Should not show the input when disabled
			const input = desktop.el.querySelector('input[placeholder="Add a note..."]');
			expect(input).toBeNull();
			// But should show the note text
			expect(desktop.getByText("Read-only note")).toBeDefined();
		});
	});

	describe("mobile cards", () => {
		it("shows add note button on mobile", () => {
			const { container } = render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={{}}
					onChange={vi.fn()}
					notes={{}}
					onNotesChange={vi.fn()}
				/>,
			);
			const mobile = getMobileCards(container);
			const noteButtons = mobile.el.querySelectorAll("button");
			const addNoteButtons = Array.from(noteButtons).filter((b) =>
				b.textContent?.includes("Add note"),
			);
			expect(addNoteButtons.length).toBe(3);
		});

		it("expands note input when add note is clicked on mobile", async () => {
			const user = userEvent.setup();
			const { container } = render(
				<AvailabilityGrid
					dates={sampleDates}
					responses={{}}
					onChange={vi.fn()}
					notes={{}}
					onNotesChange={vi.fn()}
				/>,
			);
			const mobile = getMobileCards(container);
			const noteButtons = Array.from(mobile.el.querySelectorAll("button")).filter((b) =>
				b.textContent?.includes("Add note"),
			);
			await user.click(noteButtons[0]);

			const input = mobile.el.querySelector('input[placeholder="Add a note..."]');
			expect(input).not.toBeNull();
		});
	});
});
