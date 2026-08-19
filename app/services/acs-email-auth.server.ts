import { createHash, createHmac } from "node:crypto";
import { EmailClient } from "@azure/communication-email";
import {
	createDefaultHttpClient,
	type HttpClient,
	type PipelineRequest,
	type PipelineResponse,
} from "@azure/core-rest-pipeline";
import { logger } from "./logger.server.js";

export const DEFAULT_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS = 60;
export const MAX_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS = 120;
const CLOCK_SKEW_PATTERN =
	"time difference between the originating client and the server is greater than the allowed margin";
const CLOCK_SKEW_RETRY_BASE_DELAY_MS = 100;
const CLOCK_SKEW_RETRY_JITTER_MS = 200;

export function parseEmailClockSkewToleranceSeconds(value: string | undefined): number {
	if (value === undefined || value === "") {
		return DEFAULT_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS;
	}

	if (!/^\d+$/.test(value)) {
		throw new Error("EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS must be an integer");
	}

	const seconds = Number(value);
	if (seconds > MAX_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS) {
		throw new Error(
			`EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS must be between 0 and ${MAX_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS}`,
		);
	}

	return seconds;
}

function getAccessKey(connectionString: string): string {
	for (const segment of connectionString.split(";")) {
		const separator = segment.indexOf("=");
		if (separator === -1) continue;
		if (segment.slice(0, separator).trim().toLowerCase() === "accesskey") {
			const key = segment.slice(separator + 1).trim();
			if (key) return key;
		}
	}

	throw new Error("AZURE_COMMUNICATION_CONNECTION_STRING is missing AccessKey");
}

function getSerializedRequestBody(request: PipelineRequest): string {
	if (request.body === undefined || request.body === null) return "";
	if (typeof request.body === "string") return request.body;
	throw new Error("ACS Email SDK changed its serialized request body type; refusing to re-sign");
}

function assertSdkCredentialPolicyRan(request: PipelineRequest): void {
	const authorization = request.headers.get("authorization");
	const sdkDate = request.headers.get("x-ms-date");
	const sdkContentHash = request.headers.get("x-ms-content-sha256");
	const sdkHost = request.headers.get("host");

	if (
		!authorization?.startsWith("HMAC-SHA256 ") ||
		!sdkDate ||
		Number.isNaN(Date.parse(sdkDate)) ||
		!sdkContentHash ||
		!sdkHost
	) {
		throw new Error(
			"ACS Email SDK credential policy did not run before clock-skew re-signing; " +
				"review pipeline ordering after the SDK upgrade",
		);
	}
}

function resignRequest(
	request: PipelineRequest,
	accessKey: string,
	toleranceSeconds: number,
	serverTimeOffsetMs = 0,
): void {
	assertSdkCredentialPolicyRan(request);
	const signedAt = new Date(
		Date.now() + serverTimeOffsetMs - toleranceSeconds * 1000,
	).toUTCString();
	const contentHash = createHash("sha256")
		.update(getSerializedRequestBody(request))
		.digest("base64");
	const url = new URL(request.url);
	const query = url.searchParams.toString();
	const pathAndQuery = query ? `${url.pathname}?${query}` : url.pathname;
	const host = url.host;
	const stringToSign = `${request.method.toUpperCase()}\n${pathAndQuery}\n${signedAt};${host};${contentHash}`;
	const signature = createHmac("sha256", Buffer.from(accessKey, "base64"))
		.update(stringToSign)
		.digest("base64");

	request.headers.set("host", host);
	request.headers.set("x-ms-date", signedAt);
	request.headers.set("x-ms-content-sha256", contentHash);
	request.headers.set(
		"Authorization",
		`HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
	);
}

function isClockSkewResponse(response: PipelineResponse): boolean {
	return (
		response.status === 401 &&
		(response.bodyAsText?.toLowerCase().includes(CLOCK_SKEW_PATTERN) ?? false)
	);
}

function getServerTimeOffsetMs(response: PipelineResponse): number | null {
	const serverDate = response.headers.get("date");
	if (!serverDate) return null;
	const serverTimeMs = Date.parse(serverDate);
	if (Number.isNaN(serverTimeMs)) return null;
	return serverTimeMs - Date.now();
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSkewTolerantEmailClient(
	connectionString: string,
	toleranceSeconds: number,
	transport: HttpClient = createDefaultHttpClient(),
): EmailClient {
	if (
		!Number.isInteger(toleranceSeconds) ||
		toleranceSeconds < 0 ||
		toleranceSeconds > MAX_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS
	) {
		throw new Error(
			`Email clock-skew tolerance must be an integer between 0 and ${MAX_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS}`,
		);
	}

	const accessKey = getAccessKey(connectionString);
	const httpClient: HttpClient = {
		async sendRequest(request) {
			resignRequest(request, accessKey, toleranceSeconds);
			const response = await transport.sendRequest(request);
			if (!isClockSkewResponse(response)) return response;

			const serverTimeOffsetMs = getServerTimeOffsetMs(response);
			if (serverTimeOffsetMs === null) {
				logger.error(
					{ status: response.status },
					"ACS clock-skew response had no valid Date header; cannot correct request time",
				);
				return response;
			}

			const delay =
				CLOCK_SKEW_RETRY_BASE_DELAY_MS + Math.floor(Math.random() * CLOCK_SKEW_RETRY_JITTER_MS);
			logger.warn(
				{ delay, serverTimeOffsetMs },
				"ACS clock skew detected; retrying once with Azure server-time offset",
			);
			await sleep(delay);

			resignRequest(request, accessKey, 0, serverTimeOffsetMs);
			const retryResponse = await transport.sendRequest(request);
			if (isClockSkewResponse(retryResponse)) {
				logger.error(
					{ serverTimeOffsetMs },
					"ACS rejected the server-time-corrected email request; clock-skew retry exhausted",
				);
			}
			return retryResponse;
		},
	};

	return new EmailClient(connectionString, { httpClient });
}
