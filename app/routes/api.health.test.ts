import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trackDependency } = vi.hoisted(() => ({
	trackDependency: vi.fn(),
}));

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

vi.mock("~/services/telemetry.server", () => ({
	getTelemetryClient: vi.fn(() => ({ trackDependency })),
}));

import { loader } from "~/routes/api.health";
import { db } from "../../src/db/index.js";

describe("GET /api/health", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

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
		expect(db.execute).toHaveBeenCalledTimes(1);
		expect(trackDependency).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "PostgreSQL health probe",
				resultCode: "OK",
				success: true,
			}),
		);
	});

	it("returns 200 when a transient DB failure recovers within the retry budget", async () => {
		const connectionError = Object.assign(new Error("connect ECONNREFUSED 20.12.201.42:5432"), {
			code: "ECONNREFUSED",
		});
		(db.execute as ReturnType<typeof vi.fn>)
			.mockRejectedValueOnce(new Error("Failed query: SELECT 1", { cause: connectionError }))
			.mockResolvedValueOnce([{ "?column?": 1 }]);

		const responsePromise = loader({
			request: new Request("http://localhost:5173/api/health"),
			params: {},
			context: {},
		});
		await vi.runAllTimersAsync();
		const response = await responsePromise;
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({
			status: "ok",
			db: "connected",
			timestamp: expect.any(String),
		});
		expect(db.execute).toHaveBeenCalledTimes(2);
		expect(trackDependency).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				resultCode: "ECONNREFUSED",
				success: false,
				properties: expect.objectContaining({ attempt: 1, retrying: true }),
			}),
		);
		expect(trackDependency).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				resultCode: "OK",
				success: true,
				properties: expect.objectContaining({ attempt: 2 }),
			}),
		);
	});

	it("returns 503 only after transient DB failures exhaust the retry budget", async () => {
		const connectionError = Object.assign(new Error("connect ECONNREFUSED 20.12.201.42:5432"), {
			code: "ECONNREFUSED",
		});
		(db.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("Failed query: SELECT 1", { cause: connectionError }),
		);

		const request = new Request("http://localhost:5173/api/health");
		const responsePromise = loader({ request, params: {}, context: {} });
		await vi.runAllTimersAsync();
		const response = await responsePromise;
		const data = await response.json();

		expect(response.status).toBe(503);
		expect(data.status).toBe("degraded");
		expect(data.db).toBe("unreachable");
		expect(data.error).toBe("Database health probe failed after 3 attempts");
		expect(data.timestamp).toBeDefined();
		expect(db.execute).toHaveBeenCalledTimes(3);
		expect(trackDependency).toHaveBeenCalledTimes(3);
	});

	it("does not retry a non-transient query error", async () => {
		(db.execute as ReturnType<typeof vi.fn>).mockRejectedValue(
			Object.assign(new Error("permission denied for relation"), { code: "42501" }),
		);

		const response = await loader({
			request: new Request("http://localhost:5173/api/health"),
			params: {},
			context: {},
		});
		const data = await response.json();

		expect(response.status).toBe(503);
		expect(data.error).toBe("Database health probe failed after 1 attempt");
		expect(db.execute).toHaveBeenCalledTimes(1);
	});
});
