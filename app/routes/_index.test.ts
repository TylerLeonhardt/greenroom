import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/logger.server", () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { loader } from "~/routes/_index";

describe("GET /", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.SUPPORT_URL;
	});

	it("returns supportUrl when SUPPORT_URL is set", async () => {
		process.env.SUPPORT_URL = "https://www.paypal.me/TestUser";

		const response = loader();
		const data = await response.json();

		expect(data.supportUrl).toBe("https://www.paypal.me/TestUser");
	});

	it("returns supportUrl as null when SUPPORT_URL is not set", async () => {
		const response = loader();
		const data = await response.json();

		expect(data.supportUrl).toBeNull();
	});

	it("does not redirect authenticated users", async () => {
		const response = loader();
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.supportUrl).toBeNull();
	});
});
