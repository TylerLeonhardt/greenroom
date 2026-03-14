import { expect, test } from "@playwright/test";
import { ADMIN_STATE, loadTestData } from "./helpers/test-data";

const td = loadTestData();

/** Build the batch creation URL for a subset of availability request dates. */
function batchUrl(dates: string[]): string {
	return `/groups/${td.group.id}/availability/${td.availabilityRequest.id}/batch?dates=${dates.join(",")}`;
}

test.describe("Batch Event Creation", () => {
	test.use({ storageState: ADMIN_STATE });

	test.describe("Happy Path — Fast Path", () => {
		test("creates events with defaults (minimal interaction)", async ({ page }) => {
			const dates = td.availabilityRequest.dates.slice(0, 3);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Page heading reflects correct count
			await expect(
				page.getByRole("heading", { name: `Create ${dates.length} Events` }),
			).toBeVisible();

			// Title is pre-filled from the availability request
			await expect(page.locator("#title")).toHaveValue(td.availabilityRequest.title);

			// Event type defaults to "Rehearsal" (active button has emerald styling)
			await expect(page.getByRole("button", { name: "Rehearsal" })).toHaveClass(/bg-emerald/);

			// Times default to 7 PM – 9 PM when the request has no time range
			await expect(page.locator("#startTime")).toHaveValue("19:00");
			await expect(page.locator("#endTime")).toHaveValue("21:00");

			// Optional fields are hidden by default
			await expect(page.getByText("Add description")).toBeVisible();
			await expect(page.getByText("Add locations per date")).toBeVisible();

			// Proceed to review
			await page.getByRole("button", { name: /Review Events/ }).click();

			// Review step — banner shows correct count
			await expect(page.getByText(`Ready to Create — ${dates.length} events`)).toBeVisible();

			// Each event card shows the title
			const titleElements = page.getByText(td.availabilityRequest.title);
			await expect(titleElements.first()).toBeVisible();

			// Each event card shows "Rehearsal" type badge
			const rehearsalBadges = page.locator("span", { hasText: "Rehearsal" });
			await expect(rehearsalBadges).toHaveCount(dates.length);

			// Each event card shows the time range
			await expect(page.getByText("7:00 PM – 9:00 PM").first()).toBeVisible();

			// Submit button shows correct count
			const submitButton = page.getByRole("button", {
				name: `Create ${dates.length} Events`,
			});
			await expect(submitButton).toBeVisible();

			// Submit and verify success
			await submitButton.click();
			await page.waitForURL(/batchSuccess=true/, { timeout: 15_000 });
			await expect(page.getByText(/Successfully created/)).toBeVisible();
		});
	});

	test.describe("Happy Path — Full Customization", () => {
		test("creates events with all fields customized", async ({ page }) => {
			// Use different dates than the fast path to avoid duplicate events
			const dates = td.availabilityRequest.dates.slice(3, 5);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Custom title
			await page.locator("#title").clear();
			await page.locator("#title").fill("Friday Night Show");

			// Change event type to "Show"
			await page.getByRole("button", { name: "Show" }).click();

			// Toggle description ON and fill it
			await page.getByText("Add description").click();
			await page.locator("#description").fill("A special performance");

			// Custom times
			await page.locator("#startTime").fill("20:00");
			await page.locator("#endTime").fill("22:00");

			// Toggle locations ON and set per-date locations
			await page.getByText("Add locations per date").click();
			const locationInputs = page.locator('input[placeholder="Location"]');
			for (let i = 0; i < dates.length; i++) {
				await locationInputs.nth(i).fill(`Venue ${i + 1}`);
			}

			// Proceed to review
			await page.getByRole("button", { name: /Review Events/ }).click();

			// Verify all customizations in review
			await expect(page.getByText("Friday Night Show").first()).toBeVisible();
			const showBadges = page.locator("span", { hasText: "Show" });
			await expect(showBadges.first()).toBeVisible();
			await expect(page.getByText("8:00 PM – 10:00 PM").first()).toBeVisible();

			// Verify per-date locations
			for (let i = 0; i < dates.length; i++) {
				await expect(page.getByText(`Venue ${i + 1}`)).toBeVisible();
			}

			// Submit and verify success
			await page.getByRole("button", { name: `Create ${dates.length} Events` }).click();
			await page.waitForURL(/batchSuccess=true/, { timeout: 15_000 });
			await expect(page.getByText(/Successfully created/)).toBeVisible();
		});
	});

	test.describe("Toggle Behavior", () => {
		test("toggling description off clears the text", async ({ page }) => {
			const dates = td.availabilityRequest.dates.slice(0, 2);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Toggle description ON and type something
			await page.getByText("Add description").click();
			await page.locator("#description").fill("Some rehearsal notes");
			await expect(page.locator("#description")).toHaveValue("Some rehearsal notes");

			// Toggle description OFF via "Remove" button
			await page.getByRole("button", { name: "Remove" }).click();

			// Description is hidden, toggle link is back
			await expect(page.locator("#description")).not.toBeVisible();
			await expect(page.getByText("Add description")).toBeVisible();

			// Toggle back ON — should be empty
			await page.getByText("Add description").click();
			await expect(page.locator("#description")).toHaveValue("");
		});

		test("toggling locations off clears all location data", async ({ page }) => {
			const dates = td.availabilityRequest.dates.slice(0, 2);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Toggle locations ON and fill values
			await page.getByText("Add locations per date").click();
			const locationInputs = page.locator('input[placeholder="Location"]');
			await locationInputs.first().fill("Theater A");
			await locationInputs.last().fill("Theater B");

			// Toggle locations OFF via "Remove" button
			await page.getByRole("button", { name: "Remove" }).click();

			// Locations section is hidden, toggle button is back
			await expect(page.locator('input[placeholder="Location"]').first()).not.toBeVisible();
			await expect(page.getByText("Add locations per date")).toBeVisible();

			// Toggle back ON — all inputs should be empty
			await page.getByText("Add locations per date").click();
			const newLocationInputs = page.locator('input[placeholder="Location"]');
			for (let i = 0; i < dates.length; i++) {
				await expect(newLocationInputs.nth(i)).toHaveValue("");
			}
		});
	});

	test.describe("Validation", () => {
		test("Review button is disabled without a title", async ({ page }) => {
			const dates = td.availabilityRequest.dates.slice(0, 2);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Clear the pre-filled title
			await page.locator("#title").clear();

			// Review button should be disabled
			await expect(page.getByRole("button", { name: /Review Events/ })).toBeDisabled();
		});

		test("times have defaults so Review button is enabled", async ({ page }) => {
			const dates = td.availabilityRequest.dates.slice(0, 2);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Start/end times have defaults
			await expect(page.locator("#startTime")).toHaveValue("19:00");
			await expect(page.locator("#endTime")).toHaveValue("21:00");

			// Review button is enabled (title pre-filled + times defaulted)
			await expect(page.getByRole("button", { name: /Review Events/ })).toBeEnabled();
		});
	});

	test.describe("Per-Date Locations", () => {
		test("Apply to All sets the same location for every date", async ({ page }) => {
			const dates = td.availabilityRequest.dates.slice(0, 3);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Toggle locations ON
			await page.getByText("Add locations per date").click();

			// Type in the "Apply to All" field and click the button
			await page.locator('input[placeholder="Same location for all dates"]').fill("Main Theater");
			await page.getByRole("button", { name: "Apply to All" }).click();

			// Every per-date input should have the same value
			const locationInputs = page.locator('input[placeholder="Location"]');
			for (let i = 0; i < dates.length; i++) {
				await expect(locationInputs.nth(i)).toHaveValue("Main Theater");
			}
		});

		test("overriding one date does not affect the others", async ({ page }) => {
			const dates = td.availabilityRequest.dates.slice(0, 3);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Toggle locations ON, apply "Main Theater" to all
			await page.getByText("Add locations per date").click();
			await page.locator('input[placeholder="Same location for all dates"]').fill("Main Theater");
			await page.getByRole("button", { name: "Apply to All" }).click();

			// Override only the second date
			const locationInputs = page.locator('input[placeholder="Location"]');
			await locationInputs.nth(1).clear();
			await locationInputs.nth(1).fill("Side Stage");

			// First and third still have "Main Theater", second has "Side Stage"
			await expect(locationInputs.nth(0)).toHaveValue("Main Theater");
			await expect(locationInputs.nth(1)).toHaveValue("Side Stage");
			await expect(locationInputs.nth(2)).toHaveValue("Main Theater");
		});
	});

	test.describe("Review ↔ Configure Navigation", () => {
		test("can go back from review to configure and preserve form state", async ({ page }) => {
			const dates = td.availabilityRequest.dates.slice(0, 2);
			await page.goto(batchUrl(dates));
			await page.waitForLoadState("networkidle");

			// Fill in a custom title
			await page.locator("#title").clear();
			await page.locator("#title").fill("Custom Rehearsal");

			// Go to review
			await page.getByRole("button", { name: /Review Events/ }).click();
			await expect(page.getByText("Ready to Create")).toBeVisible();

			// Go back to configure
			await page.getByRole("button", { name: /Back to Configuration/ }).click();

			// Title should still have the custom value
			await expect(page.locator("#title")).toHaveValue("Custom Rehearsal");

			// Times should still have defaults
			await expect(page.locator("#startTime")).toHaveValue("19:00");
			await expect(page.locator("#endTime")).toHaveValue("21:00");
		});
	});
});
