import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { loadTestData, MEMBER_STATE } from "./helpers/test-data";

const td = loadTestData();

function getPool(): pg.Pool {
	return new pg.Pool({
		connectionString:
			process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/greenroom",
	});
}

/**
 * Regression coverage for the bug where an event's creator, if they were only a
 * plain group member (not an admin), could not manage participants on the event
 * they created. The creator should have full access to add performers and change
 * roles — the same as edit/delete already allowed.
 *
 * We seed a "show" event created by the seeded (non-admin) member and then drive
 * the browser as that member.
 */
test.describe("Event creator manages participants (non-admin)", () => {
	test.use({ storageState: MEMBER_STATE });

	let eventId: string;

	test.beforeAll(async () => {
		const pool = getPool();
		try {
			eventId = crypto.randomUUID();
			const start = new Date();
			start.setDate(start.getDate() + 21);
			start.setHours(19, 0, 0, 0);
			const end = new Date(start);
			end.setHours(21, 0, 0, 0);

			await pool.query(
				`INSERT INTO events
					(id, group_id, title, event_type, start_time, end_time, created_by_id, timezone, created_at, updated_at)
				 VALUES ($1, $2, $3, 'show', $4, $5, $6, 'UTC', NOW(), NOW())`,
				[
					eventId,
					td.group.id,
					"Creator-Managed Show",
					start.toISOString(),
					end.toISOString(),
					td.member.id, // created by the non-admin member
				],
			);
		} finally {
			await pool.end();
		}
	});

	test.afterAll(async () => {
		const pool = getPool();
		try {
			await pool.query(`DELETE FROM event_assignments WHERE event_id = $1`, [eventId]);
			await pool.query(`DELETE FROM events WHERE id = $1`, [eventId]);
		} finally {
			await pool.end();
		}
	});

	test("creator can add a performer and change their role", async ({ page }) => {
		await page.goto(`/groups/${td.group.id}/events/${eventId}`);
		await page.waitForLoadState("networkidle");

		// The non-admin creator sees the management affordance (this was hidden before the fix).
		const addPerformers = page.getByRole("button", { name: /^Add Performers$/ });
		await expect(addPerformers).toBeVisible();
		await addPerformers.click();

		// Add the admin (an unassigned member) as a Performer.
		await page.locator("label", { hasText: td.admin.name }).first().click();
		await page.getByRole("button", { name: /^Add 1 Performer$/ }).click();

		// The performer now shows up in the Cast and the count is 1.
		await expect(page.getByRole("heading", { name: /Cast \(1\)/ })).toBeVisible();
		await expect(page.getByText(td.admin.name).first()).toBeVisible();

		// Change that performer's role to Viewer via the participant menu.
		await page.getByRole("button", { name: "Participant actions" }).first().click();
		await page.getByRole("menuitem", { name: /Change Role/ }).click();
		await page.getByRole("menuitem", { name: /^👀 Viewer$/ }).click();

		// The member moves to the Attending (Viewers) section — role change succeeded.
		await expect(page.getByRole("heading", { name: /Attending \(1\)/ })).toBeVisible();
		await expect(page.getByRole("heading", { name: /Cast \(0\)/ })).toBeVisible();
	});
});
