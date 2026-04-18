/**
 * Demo script: Records a video walkthrough of the Availability Notes feature.
 *
 * Uses the component explorer (no database required) to showcase:
 * 1. Availability grid without notes
 * 2. Interactively adding notes to dates
 * 3. Pre-populated notes fixture
 * 4. Long notes at the 200-char limit
 * 5. Results heatmap with respondent notes
 *
 * Usage: npx tsx scripts/demo-availability-notes.ts
 * Requires: component explorer running on port 5337
 */

import path from "node:path";
import { chromium } from "@playwright/test";

const EXPLORER_URL = "http://localhost:5337/___explorer?mode=headless";
const VIDEO_DIR = path.resolve(import.meta.dirname, "..");
const VIEWPORT = { width: 1280, height: 900 };

async function waitForExplorer(page: import("@playwright/test").Page) {
	await page.goto(EXPLORER_URL);
	await page.waitForFunction(() => window.__componentExplorer__ !== undefined, undefined, {
		timeout: 15000,
	});
	await page.waitForFunction(() => window.__componentExplorer__.updateVersion > 0, undefined, {
		timeout: 10000,
	});
}

async function renderFixture(page: import("@playwright/test").Page, fixtureId: string) {
	const report = await page.evaluate(async (id: string) => {
		return await (
			window as unknown as {
				__componentExplorer__: {
					renderFixture: (id: string) => Promise<{ hasError: boolean; events: unknown[] }>;
				};
			}
		).__componentExplorer__.renderFixture(id);
	}, fixtureId);
	if (report.hasError) {
		throw new Error(`Fixture "${fixtureId}" failed: ${JSON.stringify(report.events)}`);
	}
	// Let the component render and settle
	await page.waitForTimeout(800);
}

async function main() {
	console.log("🎬 Starting availability notes demo recording...");

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: VIEWPORT,
		recordVideo: {
			dir: VIDEO_DIR,
			size: VIEWPORT,
		},
	});

	const page = await context.newPage();

	try {
		// ── Scene 1: Grid WITHOUT notes (baseline) ──────────────────
		console.log("📍 Scene 1: Availability grid — Fully Responded (no notes)");
		await waitForExplorer(page);
		await renderFixture(page, "availability-grid/Fully Responded");
		await page.waitForTimeout(2500);

		// ── Scene 2: Grid with note buttons visible but empty ────────
		console.log("📍 Scene 2: Availability grid — No Notes (buttons visible)");
		await renderFixture(page, "availability-grid/No Notes");
		await page.waitForTimeout(2000);

		// Click "add note" on the first date (March 23)
		console.log("   ✏️  Clicking 'Add note' on first date...");
		const noteButtons = page.locator('button[title="Add note"]');
		await noteButtons.first().click();
		await page.waitForTimeout(800);

		// Type a note
		console.log('   ✏️  Typing "Only free after 6pm"...');
		const noteInput = page.locator('input[placeholder="Add a note..."]').first();
		await noteInput.click();
		await noteInput.type("Only free after 6pm", { delay: 60 });
		await page.waitForTimeout(1500);

		// Click "add note" on another date
		console.log("   ✏️  Clicking 'Add note' on another date...");
		const secondNoteButton = noteButtons.nth(1);
		await secondNoteButton.click();
		await page.waitForTimeout(800);

		// Type another note
		console.log('   ✏️  Typing "Have a conflict at 3pm"...');
		const secondNoteInput = page.locator('input[placeholder="Add a note..."]').nth(1);
		await secondNoteInput.click();
		await secondNoteInput.type("Have a conflict at 3pm", { delay: 60 });
		await page.waitForTimeout(2000);

		// ── Scene 3: Pre-populated notes ─────────────────────────────
		console.log("📍 Scene 3: Availability grid — With Notes (pre-populated)");
		await renderFixture(page, "availability-grid/With Notes");
		await page.waitForTimeout(3000);

		// ── Scene 4: Long notes ──────────────────────────────────────
		console.log("📍 Scene 4: Availability grid — Long Notes (200-char limit)");
		await renderFixture(page, "availability-grid/Long Notes");
		await page.waitForTimeout(3000);

		// ── Scene 5: Results heatmap with respondent notes ───────────
		console.log("📍 Scene 5: Results heatmap — With Respondent Notes");
		await renderFixture(page, "results-heatmap/With Respondent Notes");
		await page.waitForTimeout(2000);

		// Expand a date row to show notes inline
		console.log("   🔍 Expanding date rows to reveal notes...");
		const dateRows = page.locator('button:has-text("Mar")');
		const rowCount = await dateRows.count();
		for (let i = 0; i < Math.min(rowCount, 3); i++) {
			await dateRows.nth(i).click();
			await page.waitForTimeout(1500);
		}

		// Hold on the final view
		await page.waitForTimeout(2500);

		console.log("✅ Demo recording complete!");
	} catch (err) {
		console.error("❌ Error during recording:", err);
	} finally {
		// Close context to finalize video
		await context.close();
		await browser.close();
	}

	// The video is saved automatically — find it
	const fs = await import("node:fs");
	const files = fs.readdirSync(VIDEO_DIR).filter((f: string) => f.endsWith(".webm"));
	const latestVideo = files
		.map((f: string) => ({
			name: f,
			time: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs,
		}))
		.sort((a: { time: number }, b: { time: number }) => b.time - a.time)[0];

	if (latestVideo) {
		const src = path.join(VIDEO_DIR, latestVideo.name);
		const dest = path.join(VIDEO_DIR, "demo-availability-notes.webm");
		fs.renameSync(src, dest);
		console.log(`🎥 Video saved: ${dest}`);
	} else {
		console.log("⚠️  No video file found — check Playwright video recording support");
	}
}

main().catch(console.error);
