import { createHash, createHmac } from "node:crypto";
import {
	createHttpHeaders,
	type HttpClient,
	type PipelineRequest,
	type PipelineResponse,
} from "@azure/core-rest-pipeline";
import { describe, expect, it, vi } from "vitest";
import {
	createSkewTolerantEmailClient,
	DEFAULT_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS,
	parseEmailClockSkewToleranceSeconds,
} from "./acs-email-auth.server.js";

const ACS_CLOCK_SKEW_MARGIN_MS = 300_000;
const CLOCK_SKEW_MESSAGE =
	"time difference between the originating client and the server is greater than the allowed margin";
const ACCEPTED_BY_VALIDATOR = "accepted by independent ACS validator";
const rawKey = "clock-skew-test-key";
const accessKey = Buffer.from(rawKey).toString("base64");

type SignedRequestSnapshot = {
	contentHash: string;
	host: string;
	signedAtMs: number;
};

function assertValidHmac(request: PipelineRequest): SignedRequestSnapshot {
	expect(typeof request.body).toBe("string");
	const body = typeof request.body === "string" ? request.body : "";
	const contentHash = createHash("sha256").update(body).digest("base64");
	expect(request.headers.get("x-ms-content-sha256")).toBe(contentHash);

	const signedAt = request.headers.get("x-ms-date") ?? "";
	const signedAtMs = Date.parse(signedAt);
	expect(Number.isNaN(signedAtMs)).toBe(false);

	const url = new URL(request.url);
	const pathAndQuery = url.search ? `${url.pathname}${url.search}` : url.pathname;
	const host = request.headers.get("host") ?? "";
	const stringToSign =
		`${request.method.toUpperCase()}\n${pathAndQuery}\n` +
		`${new Date(signedAtMs).toUTCString()};${host};${contentHash}`;
	const expectedSignature = createHmac("sha256", rawKey).update(stringToSign).digest("base64");
	expect(request.headers.get("authorization")).toBe(
		`HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${expectedSignature}`,
	);

	return { contentHash, host, signedAtMs };
}

function clockSkewResponse(
	request: PipelineRequest,
	serverNow: Date,
	includeDate = true,
): PipelineResponse {
	return {
		request,
		status: 401,
		headers: createHttpHeaders({
			"content-type": "application/json",
			...(includeDate ? { date: serverNow.toUTCString() } : {}),
		}),
		bodyAsText: JSON.stringify({
			error: {
				code: "AuthenticationFailed",
				message: CLOCK_SKEW_MESSAGE,
			},
		}),
	};
}

function createAcsValidator(
	serverNow: Date,
	snapshots: SignedRequestSnapshot[],
	options: { includeDate?: boolean } = {},
): HttpClient {
	return {
		async sendRequest(request) {
			const snapshot = assertValidHmac(request);
			snapshots.push(snapshot);
			if (Math.abs(snapshot.signedAtMs - serverNow.getTime()) <= ACS_CLOCK_SKEW_MARGIN_MS) {
				throw new Error(ACCEPTED_BY_VALIDATOR);
			}
			return clockSkewResponse(request, serverNow, options.includeDate);
		},
	};
}

async function sendThroughRealPipeline(
	serverNow: Date,
	hostNow: Date,
	options: { endpoint?: string; includeDate?: boolean } = {},
): Promise<SignedRequestSnapshot[]> {
	vi.useFakeTimers();
	vi.setSystemTime(hostNow);
	vi.spyOn(Math, "random").mockReturnValue(0);
	const snapshots: SignedRequestSnapshot[] = [];
	const endpoint = options.endpoint ?? "https://test.communication.azure.com/";
	const connectionString = `endpoint=${endpoint};accesskey=${accessKey}`;

	try {
		const client = createSkewTolerantEmailClient(
			connectionString,
			DEFAULT_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS,
			createAcsValidator(serverNow, snapshots, options),
		);
		const sendPromise = client.beginSend({
			senderAddress: "DoNotReply@mycalltime.app",
			content: { subject: "Clock skew test", html: "<p>Test</p>" },
			recipients: { to: [{ address: "test@example.com" }] },
		});
		const rejection = expect(sendPromise).rejects.toThrow(ACCEPTED_BY_VALIDATOR);
		await vi.runAllTimersAsync();
		await rejection;
		return snapshots;
	} finally {
		vi.useRealTimers();
		vi.restoreAllMocks();
	}
}

describe("ACS email clock-skew authentication", () => {
	const serverNow = new Date("2026-08-19T19:33:00.000Z");

	it("accepts a sub-minute fast clock within ACS's real 300-second window", async () => {
		const snapshots = await sendThroughRealPipeline(
			serverNow,
			new Date(serverNow.getTime() + 45_000),
		);

		expect(snapshots).toHaveLength(1);
		expect(snapshots[0]?.signedAtMs - serverNow.getTime()).toBe(-15_000);
	});

	it("recovers a seven-minute fast clock that fixed backdating cannot repair", async () => {
		const snapshots = await sendThroughRealPipeline(
			serverNow,
			new Date(serverNow.getTime() + 7 * 60_000),
		);

		expect(snapshots).toHaveLength(2);
		expect(snapshots[0]?.signedAtMs - serverNow.getTime()).toBe(6 * 60_000);
		expect(Math.abs(snapshots[0]?.signedAtMs - serverNow.getTime())).toBeGreaterThan(
			ACS_CLOCK_SKEW_MARGIN_MS,
		);
		expect(snapshots[1]?.signedAtMs - serverNow.getTime()).toBe(0);
	});

	it("recovers a seven-minute slow clock instead of making it worse with backdating", async () => {
		const snapshots = await sendThroughRealPipeline(
			serverNow,
			new Date(serverNow.getTime() - 7 * 60_000),
		);

		expect(snapshots).toHaveLength(2);
		expect(snapshots[0]?.signedAtMs - serverNow.getTime()).toBe(-8 * 60_000);
		expect(Math.abs(snapshots[0]?.signedAtMs - serverNow.getTime())).toBeGreaterThan(
			ACS_CLOCK_SKEW_MARGIN_MS,
		);
		expect(snapshots[1]?.signedAtMs - serverNow.getTime()).toBe(0);
	});

	it("does not retry when Azure's clock-skew response has no Date header", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(serverNow.getTime() + 7 * 60_000));
		const snapshots: SignedRequestSnapshot[] = [];
		const connectionString = `endpoint=https://test.communication.azure.com/;accesskey=${accessKey}`;

		try {
			const client = createSkewTolerantEmailClient(
				connectionString,
				DEFAULT_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS,
				createAcsValidator(serverNow, snapshots, { includeDate: false }),
			);
			await expect(
				client.beginSend({
					senderAddress: "DoNotReply@mycalltime.app",
					content: { subject: "Clock skew test", html: "<p>Test</p>" },
					recipients: { to: [{ address: "test@example.com" }] },
				}),
			).rejects.toThrow(CLOCK_SKEW_MESSAGE);
			expect(snapshots).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("canonicalizes an explicit endpoint port without duplicating it", async () => {
		const snapshots = await sendThroughRealPipeline(serverNow, serverNow, {
			endpoint: "https://test.communication.azure.com:8443/",
		});

		expect(snapshots[0]?.host).toBe("test.communication.azure.com:8443");
	});

	it("uses a secure default and rejects excessive tolerance", () => {
		expect(parseEmailClockSkewToleranceSeconds(undefined)).toBe(60);
		expect(parseEmailClockSkewToleranceSeconds("30")).toBe(30);
		expect(() => parseEmailClockSkewToleranceSeconds("121")).toThrow("between 0 and 120");
		expect(() => parseEmailClockSkewToleranceSeconds("-1")).toThrow("must be an integer");
	});
});
