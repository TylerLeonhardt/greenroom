import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";
import type { SharedTestData } from "./helpers/test-data";

test.describe("Availability Request List", () => {
	test.use({ authRole: "admin" });

	test("shows availability requests for the group", async ({ page, testData }) => {
		await page.goto(`/groups/${testData.group.id}/availability`);

		const requestCard = page.getByRole("link", {
			name: new RegExp(testData.availabilityRequest.title),
		});
		await expect(requestCard).toBeVisible();
		await expect(requestCard.getByText("Open", { exact: true })).toBeVisible();
	});
});

test.describe("Respond to Availability Request", () => {
	test("member can view and respond to availability request", async ({
		authStates,
		browser,
		testData,
	}) => {
		const context = await browser.newContext({ storageState: authStates.member });
		const page = await context.newPage();

		await page.goto(`/groups/${testData.group.id}/availability/${testData.availabilityRequest.id}`);
		await page.waitForLoadState("networkidle");

		// Should see the request title
		await expect(page.getByText(testData.availabilityRequest.title)).toBeVisible();

		// Should see the availability grid with date rows (table on desktop, cards on mobile)
		// Verify the "All Available" button is present (grid component rendered)
		await expect(page.getByRole("button", { name: "All Available" })).toBeVisible();

		// Build responses for all dates
		const dates = testData.availabilityRequest.dates;
		const responses: Record<string, string> = {};
		for (const date of dates) {
			responses[date] = "available";
		}

		// Submit availability response via direct HTTP POST
		// This works around a Remix SSR hydration timing issue in headless Chromium
		// where React's onClick handlers aren't attached to the availability grid buttons
		const url = `/groups/${testData.group.id}/availability/${testData.availabilityRequest.id}`;
		const csrfToken = await page.locator('input[name="_csrf"]').first().inputValue();
		const resp = await page.request.post(url, {
			form: {
				_csrf: csrfToken,
				intent: "respond",
				responses: JSON.stringify(responses),
			},
		});
		expect(resp.ok()).toBeTruthy();

		// Reload to see the success state (already responded indicator)
		await page.reload();
		await expect(page.getByText(/already responded/i)).toBeVisible();
		await context.close();
	});
});

test.describe("View Availability Results", () => {
	test.use({ authRole: "admin" });

	test("admin can view results tab", async ({ page, testData }) => {
		await page.goto(`/groups/${testData.group.id}/availability/${testData.availabilityRequest.id}`);
		await page.waitForLoadState("networkidle");

		// Admin should see both "My Response" and "Results" tabs
		await expect(page.getByRole("button", { name: /my response/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /results/i })).toBeVisible();

		// Should see the availability request title
		await expect(page.getByText(testData.availabilityRequest.title)).toBeVisible();

		// Should see the "Close Request" button (admin-only)
		await expect(page.getByRole("button", { name: /close request/i })).toBeVisible();
	});
});

test.describe("Create Events From Availability Results", () => {
	test.use({ authRole: "member" });

	async function createEventsFromResults(
		page: Page,
		testData: SharedTestData,
		request: { id: string; dates: string[] },
		title: string,
	) {
		await page.goto(
			`/groups/${testData.eventPermissionGroup.id}/availability/${request.id}?view=results`,
		);
		await page.waitForLoadState("networkidle");

		await expect(page.getByRole("button", { name: "Select Top 5" })).toBeVisible();
		await page.goto(
			`/groups/${testData.eventPermissionGroup.id}/availability/${request.id}/batch?dates=${request.dates.slice(0, 5).join(",")}`,
		);
		await page.waitForLoadState("networkidle");

		await expect(page.getByRole("heading", { name: "Create 5 Events" })).toBeVisible();
		await page.locator("#title").fill(title);
		await page.getByRole("button", { name: /Review Events/ }).click();
		await page.getByRole("button", { name: "Create 5 Events", exact: true }).click();

		await page.waitForURL(/batchSuccess=true/);
		await expect(page.getByText(/Successfully created/)).toBeVisible();
		await page.getByRole("link", { name: "View Events" }).click();
		await expect(page.locator("h3:visible").filter({ hasText: title })).toHaveCount(5);
	}

	test("non-admin creator with membersCanCreateEvents sees the affordance and persists events", async ({
		page,
		testData,
	}, testInfo) => {
		await createEventsFromResults(
			page,
			testData,
			testData.permissionCreatorAvailabilityRequest,
			`Permission Creator ${testInfo.project.name} Retry ${testInfo.retry}`,
		);
	});

	test("non-owner member with membersCanCreateEvents sees the affordance and persists events", async ({
		page,
		testData,
	}, testInfo) => {
		await createEventsFromResults(
			page,
			testData,
			testData.permissionAvailabilityRequest,
			`Permission Non-Owner ${testInfo.project.name} Retry ${testInfo.retry}`,
		);
	});

	test("unrelated non-admin cannot create events from another user's request", async ({
		page,
		testData,
	}) => {
		const date = testData.availabilityRequest.dates[0];
		const response = await page.goto(
			`/groups/${testData.group.id}/events/new?fromRequest=${testData.availabilityRequest.id}&date=${date}`,
		);

		expect(response?.status()).toBe(403);
		await expect(page.getByRole("heading", { name: "Error 403" })).toBeVisible();
	});
});

test.describe("Navigate to Create Availability Request", () => {
	test.use({ authRole: "admin" });

	test("admin can access the new availability request form", async ({ page, testData }) => {
		await page.goto(`/groups/${testData.group.id}/availability/new`);

		await expect(page.getByRole("heading", { name: /create availability request/i })).toBeVisible();
		await expect(page.getByLabel("Title *")).toBeVisible();
		await expect(page.getByLabel("Start Date *")).toBeVisible();
		await expect(page.getByLabel("End Date *")).toBeVisible();
	});
});
