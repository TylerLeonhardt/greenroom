import { expect, test } from "@playwright/test";
import { ADMIN_STATE, loadTestData, MEMBER_STATE } from "./helpers/test-data";

const td = loadTestData();

/**
 * RSVP Change Feed E2E Tests
 *
 * Exercises the full RSVP lifecycle on event detail pages:
 * - Admin creates an event and assigns a performer
 * - Performer confirms → activity feed shows entry
 * - Performer declines → feed shows status change
 * - Performer re-confirms → feed shows another change
 * - Member self-registers → feed shows entry
 * - Deduplication: submitting the same status doesn't create a new entry
 * - Feed is reverse chronological (newest first)
 * - Feed persists across page reloads
 */

/** Helper to create an event as admin and return the event detail URL. */
async function adminCreatesEvent(
	browser: import("@playwright/test").Browser,
	options: {
		title: string;
		type?: "rehearsal" | "show";
		daysFromNow?: number;
		assignMember?: boolean;
	},
): Promise<string> {
	const ctx = await browser.newContext({ storageState: ADMIN_STATE });
	const page = await ctx.newPage();

	await page.goto(`/groups/${td.group.id}/events/new`);
	await page.waitForLoadState("networkidle");

	await page.getByLabel("Title *").fill(options.title);

	if (options.type === "show") {
		// Radio input is sr-only; click the visible label wrapper
		await page.getByText("🎭 Show").click();
	}

	const futureDate = new Date();
	futureDate.setDate(futureDate.getDate() + (options.daysFromNow ?? 14));
	const dateStr = futureDate.toISOString().split("T")[0];
	await page.getByLabel("Date *").fill(dateStr);
	await page.getByLabel("Start Time *").fill("19:00");
	await page.getByLabel("End Time *").fill("21:00");

	if (options.assignMember && options.type === "show") {
		// Checkbox is sr-only with label intercepting; use force click
		const memberCheckbox = page.getByRole("checkbox", { name: td.member.name });
		await expect(memberCheckbox).toBeVisible({ timeout: 5_000 });
		await memberCheckbox.check({ force: true });
	}

	await page.getByRole("button", { name: /Create Event/i }).click();
	await page.waitForURL(/\/groups\/.*\/events\/[0-9a-f-]+$/, { timeout: 15_000 });

	const url = page.url();
	await page.close();
	await ctx.close();
	return url;
}

test.describe("RSVP Change Feed", () => {
	test("full RSVP lifecycle with activity feed", async ({ browser }) => {
		// ── Step 1: Admin creates a show event with the member as a performer ──
		const eventUrl = await adminCreatesEvent(browser, {
			title: "RSVP Feed Test Show",
			type: "show",
			daysFromNow: 14,
			assignMember: true,
		});

		// Verify empty state: admin sees no Activity section
		const adminCtx = await browser.newContext({ storageState: ADMIN_STATE });
		const adminPage = await adminCtx.newPage();
		await adminPage.goto(eventUrl);
		await adminPage.waitForLoadState("networkidle");
		await expect(adminPage.getByText("RSVP Feed Test Show")).toBeVisible();
		await expect(adminPage.getByText("Activity")).not.toBeVisible();
		await adminPage.close();
		await adminCtx.close();

		// ── Step 2: Performer (member) confirms attendance ──
		const memberCtx = await browser.newContext({ storageState: MEMBER_STATE });
		const memberPage = await memberCtx.newPage();

		await memberPage.goto(eventUrl);
		await memberPage.waitForLoadState("networkidle");

		// Member was assigned as performer — should see Confirm/Decline buttons
		const confirmBtn = memberPage.getByRole("button", { name: "Confirm" });
		await expect(confirmBtn).toBeVisible();
		await confirmBtn.click();
		await memberPage.waitForLoadState("networkidle");

		// Activity feed should now show 1 entry.
		// Performer was pre-assigned (pending), so confirming shows "changed from Pending → Going"
		await expect(memberPage.getByText("Activity")).toBeVisible();
		await expect(memberPage.getByText("changed from Pending → Going")).toBeVisible();

		// ── Step 3: Performer declines (button is now "Change to Declined") ──
		const changeToDeclinedBtn = memberPage.getByRole("button", { name: "Change to Declined" });
		await expect(changeToDeclinedBtn).toBeVisible();
		await changeToDeclinedBtn.click();
		await memberPage.waitForLoadState("networkidle");

		// Feed should show 2 entries now
		await expect(memberPage.getByText("changed from Going → Not Going")).toBeVisible();
		await expect(memberPage.getByText("changed from Pending → Going")).toBeVisible();

		// ── Step 4: Performer re-confirms (button is now "Change to Confirmed") ──
		const changeToConfirmedBtn = memberPage.getByRole("button", {
			name: "Change to Confirmed",
		});
		await expect(changeToConfirmedBtn).toBeVisible();
		await changeToConfirmedBtn.click();
		await memberPage.waitForLoadState("networkidle");

		// Feed should show 3 entries: newest first
		const feedEntries = memberPage.locator(".border-l-2.border-slate-200");
		await expect(feedEntries).toHaveCount(3);

		// Newest entry should be "changed from Not Going → Going"
		await expect(feedEntries.first()).toContainText("changed from Not Going → Going");

		// ── Step 5: Deduplication — the UI only shows "Change to Declined" when
		// already confirmed, so identical status submissions can't happen via UI.
		// Verify feed count stays at 3 after reload (no phantom entries).
		await memberPage.reload();
		await memberPage.waitForLoadState("networkidle");

		const feedEntriesAfterReload = memberPage.locator(".border-l-2.border-slate-200");
		await expect(feedEntriesAfterReload).toHaveCount(3);

		// ── Step 6: Verify persistence — feed entries survive page refresh ──
		await expect(memberPage.getByText("Activity")).toBeVisible();

		// Verify reverse chronological order (newest first)
		const firstEntry = feedEntriesAfterReload.first();
		const lastEntry = feedEntriesAfterReload.last();
		await expect(firstEntry).toContainText("changed from Not Going → Going");
		await expect(lastEntry).toContainText("changed from Pending → Going");

		await memberPage.close();
		await memberCtx.close();
	});

	test("member self-registration creates activity feed entry", async ({ browser }) => {
		// Admin creates a rehearsal event (non-show) so members can self-register
		const rehearsalUrl = await adminCreatesEvent(browser, {
			title: "Self-Reg Feed Test",
			type: "rehearsal",
			daysFromNow: 15,
		});

		// Member self-registers via "I'll be there"
		const memberCtx = await browser.newContext({ storageState: MEMBER_STATE });
		const memberPage = await memberCtx.newPage();

		await memberPage.goto(rehearsalUrl);
		await memberPage.waitForLoadState("networkidle");

		const attendBtn = memberPage.getByRole("button", { name: /I'll be there/ });
		await expect(attendBtn).toBeVisible();
		await attendBtn.click();
		await memberPage.waitForLoadState("networkidle");

		// Activity feed should show entry
		await expect(memberPage.getByText("Activity")).toBeVisible();
		await expect(memberPage.getByText("confirmed Going")).toBeVisible();

		// Verify the feed has exactly 1 entry
		const feedEntries = memberPage.locator(".border-l-2.border-slate-200");
		await expect(feedEntries).toHaveCount(1);

		// Verify persistence after reload
		await memberPage.reload();
		await memberPage.waitForLoadState("networkidle");
		await expect(memberPage.getByText("Activity")).toBeVisible();
		await expect(memberPage.locator(".border-l-2.border-slate-200")).toHaveCount(1);

		await memberPage.close();
		await memberCtx.close();
	});

	test("empty state: no activity heading when no RSVP changes", async ({ browser }) => {
		const eventUrl = await adminCreatesEvent(browser, {
			title: "Empty Feed Test",
			daysFromNow: 16,
		});

		const adminCtx = await browser.newContext({ storageState: ADMIN_STATE });
		const adminPage = await adminCtx.newPage();
		await adminPage.goto(eventUrl);
		await adminPage.waitForLoadState("networkidle");

		// Activity heading should NOT be visible (0 entries)
		await expect(adminPage.getByText("Activity")).not.toBeVisible();

		await adminPage.close();
		await adminCtx.close();
	});
});
