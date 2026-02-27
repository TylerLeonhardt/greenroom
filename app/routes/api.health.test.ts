import { describe, expect, it } from "vitest";
import { loader } from "~/routes/api.health";

describe("GET /api/health", () => {
	it("returns status ok with a timestamp", async () => {
		const request = new Request("http://localhost:5173/api/health");
		const response = await loader({ request, params: {}, context: {} });
		const data = await response.json();

		expect(data.status).toBe("ok");
		expect(data.timestamp).toBeDefined();
		// Verify timestamp is a valid ISO string
		expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
	});
});
