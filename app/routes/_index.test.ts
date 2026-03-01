import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/services/auth.server", () => ({
	getOptionalUser: vi.fn(),
}));

vi.mock("~/services/logger.server", () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { loader } from "~/routes/_index";
import { getOptionalUser } from "~/services/auth.server";

describe("GET /", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.SUPPORT_URL;
	});

	it("returns supportUrl when SUPPORT_URL is set", async () => {
		(getOptionalUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		process.env.SUPPORT_URL = "https://www.paypal.me/TestUser";

		const request = new Request("http://localhost:5173/");
		const response = await loader({ request, params: {}, context: {} });
		const data = await response.json();

		expect(data.supportUrl).toBe("https://www.paypal.me/TestUser");
	});

	it("returns supportUrl as null when SUPPORT_URL is not set", async () => {
		(getOptionalUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const request = new Request("http://localhost:5173/");
		const response = await loader({ request, params: {}, context: {} });
		const data = await response.json();

		expect(data.supportUrl).toBeNull();
	});

	it("redirects authenticated users to /dashboard", async () => {
		(getOptionalUser as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: "user-1",
			name: "Test",
			email: "test@example.com",
		});

		const request = new Request("http://localhost:5173/");

		await expect(loader({ request, params: {}, context: {} })).rejects.toEqual(
			expect.objectContaining({ status: 302 }),
		);
	});
});
