import type { Page } from "@playwright/test";

declare global {
	interface Window {
		__componentExplorer__: {
			sessionId: string;
			updateVersion: number;
			listFixtures(): Array<{
				fixtureId: string;
				fixtureName: string;
				groupPath: string[];
			}>;
			renderFixture(fixtureId: string): Promise<{
				hasError: boolean;
				events: unknown[];
			}>;
		};
	}
}

const HEADLESS_URL = "/___explorer?mode=headless";

/**
 * Navigates to the component explorer in headless mode and renders a specific fixture.
 *
 * The component explorer's headless renderer requires an explicit JS call to
 * `window.__componentExplorer__.renderFixture(id)` — simply navigating to a URL
 * with a fixture parameter does not trigger rendering.
 *
 * Fixture IDs follow the pattern `{component-name}/{fixture-name}`, e.g.
 * `"copy-button/Icon Button"`.
 *
 * @example
 * await renderFixture(page, "copy-button", "Icon Button");
 */
export async function renderFixture(
	page: Page,
	componentName: string,
	fixtureName: string,
): Promise<{ hasError: boolean; events: unknown[] }> {
	const fixtureId = `${componentName}/${fixtureName}`;

	// Only navigate if we're not already on the headless page
	if (!page.url().includes("/___explorer")) {
		await page.goto(HEADLESS_URL);
	}

	// Wait for the global API and fixture registry to be populated
	await page.waitForFunction(() => window.__componentExplorer__ !== undefined);
	await page.waitForFunction(() => window.__componentExplorer__.updateVersion > 0);

	// Render the fixture into the DOM
	const report = await page.evaluate(async (id: string) => {
		return await window.__componentExplorer__.renderFixture(id);
	}, fixtureId);

	if (report.hasError) {
		throw new Error(
			`Fixture "${fixtureId}" failed to render. Events: ${JSON.stringify(report.events)}`,
		);
	}

	return report;
}
