import { describe, expect, it, vi } from "vitest";

// Mock the db module
vi.mock("../../src/db/index.js", () => ({
	db: {
		execute: vi.fn(),
	},
}));

// Mock logger
vi.mock("~/services/logger.server", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

import { loader } from "~/routes/api.health";
import { db } from "../../src/db/index.js";

describe("GET /api/health", () => {
	it("returns status ok with db connected when DB is reachable", async () => {
		(db.execute as ReturnType<typeof vi.fn>).mockResolvedValue([{ "?column?": 1 }]);

		const request = new Request("http://localhost:5173/api/health");
		const response = await loader({ request, params: {}, context: {} });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.status).toBe("ok");
		expect(data.db).toBe("connected");
		expect(data.timestamp).toBeDefined();
		expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
	});

	it("returns 503 with degraded status when DB is unreachable", async () => {
		(db.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));

		const request = new Request("http://localhost:5173/api/health");
		const response = await loader({ request, params: {}, context: {} });
		const data = await response.json();

		expect(response.status).toBe(503);
		expect(data.status).toBe("degraded");
		expect(data.db).toBe("disconnected");
		expect(data.timestamp).toBeDefined();
	});
});
