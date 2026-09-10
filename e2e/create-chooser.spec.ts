import { expect, test } from "./helpers/fixtures";

test.describe("Create chooser", () => {
	test.use({ authRole: "admin" });

	test("explains both creation options and routes to each flow", async ({ page, testData }) => {
		await page.goto(`/groups/${testData.group.id}`);

		await page.getByRole("link", { name: "Create", exact: true }).click();
		await expect(page).toHaveURL(`/groups/${testData.group.id}/create`);
		await expect(
			page.getByRole("heading", { name: "What would you like to create?" }),
		).toBeVisible();

		const availabilityCard = page.getByRole("article").filter({
			has: page.getByRole("heading", { name: "Availability Request", exact: true }),
		});
		await expect(availabilityCard).toContainText("Not sure when it will happen?");
		await availabilityCard.getByRole("link", { name: "Create availability request" }).click();
		await expect(page).toHaveURL(`/groups/${testData.group.id}/availability/new`);
		await expect(page.getByRole("heading", { name: "Create Availability Request" })).toBeVisible();

		await page.goto(`/groups/${testData.group.id}/create`);
		const eventCard = page.getByRole("article").filter({
			has: page.getByRole("heading", { name: "Event", exact: true }),
		});
		await expect(eventCard).toContainText("Know the date and lineup?");
		await eventCard.getByRole("link", { name: "Create event" }).click();
		await expect(page).toHaveURL(`/groups/${testData.group.id}/events/new`);
		await expect(page.getByRole("heading", { name: "Create Event" })).toBeVisible();
	});
});
