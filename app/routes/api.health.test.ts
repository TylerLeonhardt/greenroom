import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trackDependency, connect, query, release } = vi.hoisted(() => ({
	trackDependency: vi.fn(),
	connect: vi.fn(),
	query: vi.fn(),
	release: vi.fn(),
}));

// Mock the db module
vi.mock("../../src/db/index.js", () => ({
	db: {
		$client: { connect },
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
import { logger } from "~/services/logger.server";

describe("GET /api/health", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		connect.mockReset();
		query.mockReset();
		vi.useFakeTimers();
		connect.mockResolvedValue({ query, release });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns status ok with db connected when DB is reachable", async () => {
		query.mockResolvedValue({ rows: [{ "?column?": 1 }] });
		const startedAt = Date.now();

		const request = new Request("http://localhost:5173/api/health");
		const response = await loader({ request, params: {}, context: {} });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.status).toBe("ok");
		expect(data.db).toBe("connected");
		expect(data.timestamp).toBeDefined();
		expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
		expect(query).toHaveBeenCalledExactlyOnceWith("SELECT 1");
		expect(connect).toHaveBeenCalledTimes(1);
		expect(release).toHaveBeenCalledExactlyOnceWith(false);
		expect(Date.now() - startedAt).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
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
		query
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
		expect(query).toHaveBeenCalledTimes(2);
		expect(release.mock.calls).toEqual([[true], [false]]);
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
		query.mockRejectedValue(new Error("Failed query: SELECT 1", { cause: connectionError }));

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
		expect(query).toHaveBeenCalledTimes(3);
		expect(trackDependency).toHaveBeenCalledTimes(3);
	});

	it("does not retry a non-transient query error", async () => {
		query.mockRejectedValue(
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
		expect(query).toHaveBeenCalledTimes(1);
	});

	it.each([
		"ETIMEDOUT",
		"Connection terminated unexpectedly",
	])("recovers from a transient connection failure: %s", async (message) => {
		connect.mockRejectedValueOnce(new Error(message));
		query.mockResolvedValue({ rows: [] });
		const startedAt = Date.now();
		const responsePromise = loader({
			request: new Request("http://localhost/api/health"),
			params: {},
			context: {},
		});
		await vi.runAllTimersAsync();

		expect((await responsePromise).status).toBe(200);
		expect(connect).toHaveBeenCalledTimes(2);
		expect(Date.now() - startedAt).toBe(400);
	});

	it("returns 200 after a 900 ms outage, even when failed connections reject immediately", async () => {
		const startedAt = Date.now();
		connect.mockImplementation(async () => {
			if (Date.now() - startedAt < 900) {
				throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
			}
			return { query, release };
		});
		query.mockResolvedValue({ rows: [] });
		const responsePromise = loader({
			request: new Request("http://localhost/api/health"),
			params: {},
			context: {},
		});
		await vi.runAllTimersAsync();

		expect((await responsePromise).status).toBe(200);
		expect(connect).toHaveBeenCalledTimes(3);
		expect(Date.now() - startedAt).toBe(1200);
	});

	it("bounds hanging queries to 3000 ms and destroys each timed-out client", async () => {
		query.mockImplementation(() => new Promise(() => {}));
		const startedAt = Date.now();
		const responsePromise = loader({
			request: new Request("http://localhost/api/health"),
			params: {},
			context: {},
		});
		await vi.runAllTimersAsync();

		expect((await responsePromise).status).toBe(503);
		expect(Date.now() - startedAt).toBe(3000);
		expect(connect).toHaveBeenCalledTimes(3);
		expect(release.mock.calls).toEqual([[true], [true], [true]]);
		expect(vi.getTimerCount()).toBe(0);
		expect(trackDependency).toHaveBeenLastCalledWith(
			expect.objectContaining({
				resultCode: "ETIMEDOUT",
				duration: 600,
				success: false,
				properties: expect.objectContaining({ attempt: 3, retrying: false }),
			}),
		);
		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({ attempts: 3, totalDurationMs: 3000 }),
			"Database health probe exhausted retries",
		);
	});

	it("destroys a late-acquired client without querying it and recovers on retry", async () => {
		const lateQuery = vi.fn();
		const lateRelease = vi.fn();
		connect.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					setTimeout(() => resolve({ query: lateQuery, release: lateRelease }), 800);
				}),
		);
		query.mockResolvedValue({ rows: [] });
		const startedAt = Date.now();
		const responsePromise = loader({
			request: new Request("http://localhost/api/health"),
			params: {},
			context: {},
		});
		await vi.runAllTimersAsync();

		expect((await responsePromise).status).toBe(200);
		expect(Date.now() - startedAt).toBe(1000);
		expect(lateRelease).toHaveBeenCalledExactlyOnceWith(true);
		expect(lateQuery).not.toHaveBeenCalled();
		expect(release).toHaveBeenCalledExactlyOnceWith(false);
	});
});
