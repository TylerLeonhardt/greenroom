import type { LoaderFunctionArgs } from "@remix-run/node";
import type { PoolClient } from "pg";
import { logger } from "~/services/logger.server";
import { getTelemetryClient } from "~/services/telemetry.server";
import { db } from "../../src/db/index.js";

const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 600;
const RETRY_DELAYS_MS = [400, 800] as const;
const TRANSIENT_ERROR_CODES = new Set([
	"ECONNREFUSED",
	"ECONNRESET",
	"ETIMEDOUT",
	"EPIPE",
	"ENETUNREACH",
	"EHOSTUNREACH",
	"57P01",
	"57P02",
	"57P03",
]);
const TRANSIENT_ERROR_MESSAGES = [
	"econnrefused",
	"econnreset",
	"etimedout",
	"connection terminated",
	"connection closed unexpectedly",
	"server closed the connection unexpectedly",
	"timeout exceeded when trying to connect",
	"health probe timed out",
];

type ErrorWithDetails = {
	code?: unknown;
	cause?: unknown;
	message?: unknown;
};

function getErrorChain(error: unknown): ErrorWithDetails[] {
	const errors: ErrorWithDetails[] = [];
	let current = error;

	while (current && typeof current === "object" && errors.length < 5) {
		const details = current as ErrorWithDetails;
		errors.push(details);
		current = details.cause;
	}

	return errors;
}

function getErrorCode(error: unknown): string {
	for (const details of getErrorChain(error)) {
		if (typeof details.code === "string" && details.code.length > 0) {
			return details.code;
		}
	}
	return "ERROR";
}

function isTransientDatabaseError(error: unknown): boolean {
	for (const details of getErrorChain(error)) {
		const message = typeof details.message === "string" ? details.message.toLowerCase() : "";
		if (
			(typeof details.code === "string" && TRANSIENT_ERROR_CODES.has(details.code)) ||
			TRANSIENT_ERROR_MESSAGES.some((pattern) => message.includes(pattern))
		) {
			return true;
		}
	}

	return false;
}

function getDatabaseTarget(): string {
	try {
		return new URL(process.env.DATABASE_URL ?? "").hostname || "postgresql";
	} catch {
		return "postgresql";
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		timer.unref?.();
	});
}

async function executeProbeWithTimeout(): Promise<void> {
	let client: PoolClient | undefined;
	let timedOut = false;
	let succeeded = false;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => {
			timedOut = true;
			const error = new Error("Database health probe timed out");
			Object.assign(error, { code: "ETIMEDOUT" });
			reject(error);
		}, ATTEMPT_TIMEOUT_MS);
		timeout.unref?.();
	});

	const probe = async () => {
		const acquired = await db.$client.connect();
		// Acquisition can finish after the deadline; never start a late query or leak its client.
		if (timedOut) {
			acquired.release(true);
			return;
		}
		client = acquired;
		await client.query("SELECT 1");
	};

	try {
		await Promise.race([probe(), timeoutPromise]);
		succeeded = true;
	} finally {
		if (timeout) clearTimeout(timeout);
		// Destroy failed/timed-out connections instead of leaving queries running in the pool.
		client?.release(!succeeded);
	}
}

export async function loader(_args: LoaderFunctionArgs) {
	const probeStartedAt = Date.now();
	let lastError: unknown;
	let attempts = 0;

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		attempts = attempt;
		const attemptStartedAt = Date.now();

		try {
			await executeProbeWithTimeout();
			const durationMs = Date.now() - attemptStartedAt;

			logger.info(
				{
					route: "api.health",
					attempt,
					maxAttempts: MAX_ATTEMPTS,
					durationMs,
					totalDurationMs: Date.now() - probeStartedAt,
				},
				"Database health probe succeeded",
			);
			getTelemetryClient()?.trackDependency({
				name: "PostgreSQL health probe",
				dependencyTypeName: "PostgreSQL",
				target: getDatabaseTarget(),
				data: "SELECT 1",
				duration: durationMs,
				resultCode: "OK",
				success: true,
				properties: { attempt, maxAttempts: MAX_ATTEMPTS },
			});

			return Response.json({
				status: "ok",
				db: "connected",
				timestamp: new Date().toISOString(),
			});
		} catch (error) {
			lastError = error;
			const durationMs = Date.now() - attemptStartedAt;
			const errorCode = getErrorCode(error);
			const transient = isTransientDatabaseError(error);
			const retrying = transient && attempt < MAX_ATTEMPTS;

			logger.warn(
				{
					err: error,
					route: "api.health",
					attempt,
					maxAttempts: MAX_ATTEMPTS,
					durationMs,
					errorCode,
					transient,
					retrying,
				},
				"Database health probe failed",
			);
			getTelemetryClient()?.trackDependency({
				name: "PostgreSQL health probe",
				dependencyTypeName: "PostgreSQL",
				target: getDatabaseTarget(),
				data: "SELECT 1",
				duration: durationMs,
				resultCode: errorCode,
				success: false,
				properties: { attempt, maxAttempts: MAX_ATTEMPTS, transient, retrying },
			});

			if (!retrying) break;
			await sleep(RETRY_DELAYS_MS[attempt - 1]);
		}
	}

	logger.error(
		{
			err: lastError,
			route: "api.health",
			attempts,
			maxAttempts: MAX_ATTEMPTS,
			totalDurationMs: Date.now() - probeStartedAt,
		},
		"Database health probe exhausted retries",
	);

	return Response.json(
		{
			status: "degraded",
			db: "unreachable",
			error: `Database health probe failed after ${attempts} attempt${attempts === 1 ? "" : "s"}`,
			timestamp: new Date().toISOString(),
		},
		{ status: 503 },
	);
}
