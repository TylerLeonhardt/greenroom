import { logger } from "./logger.server.js";

interface SlidingWindowEntry {
	timestamps: number[];
}

const windows = new Map<string, SlidingWindowEntry>();

// Clean stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
	lastCleanup = now;
	const cutoff = now - windowMs;
	for (const [key, entry] of windows) {
		entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
		if (entry.timestamps.length === 0) {
			windows.delete(key);
		}
	}
}

/**
 * Checks if a request should be rate limited.
 * Returns { limited: false } if allowed, or { limited: true, retryAfter } if blocked.
 */
export function checkRateLimit(
	key: string,
	maxRequests: number,
	windowMs: number,
): { limited: false } | { limited: true; retryAfter: number } {
	cleanup(windowMs);

	const now = Date.now();
	const cutoff = now - windowMs;
	const entry = windows.get(key);

	if (!entry) {
		windows.set(key, { timestamps: [now] });
		return { limited: false };
	}

	// Remove expired timestamps
	entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

	if (entry.timestamps.length >= maxRequests) {
		const oldestInWindow = entry.timestamps[0];
		const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
		logger.warn({ key, maxRequests, windowMs }, "Rate limit exceeded");
		return { limited: true, retryAfter };
	}

	entry.timestamps.push(now);
	return { limited: false };
}

function getClientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0].trim();
	}
	return "unknown";
}

const ONE_MINUTE_MS = 60 * 1000;

export function checkLoginRateLimit(request: Request) {
	const ip = getClientIp(request);
	return checkRateLimit(`login:${ip}`, 10, ONE_MINUTE_MS);
}

export function checkSignupRateLimit(request: Request) {
	const ip = getClientIp(request);
	return checkRateLimit(`signup:${ip}`, 5, ONE_MINUTE_MS);
}

/** Visible for testing */
export function _resetForTests() {
	windows.clear();
}
