import { createHash, createHmac } from "node:crypto";
import { EmailClient } from "@azure/communication-email";
import {
	createDefaultHttpClient,
	type HttpClient,
	type PipelineRequest,
} from "@azure/core-rest-pipeline";

export const DEFAULT_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS = 60;
export const MAX_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS = 120;

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

function getRequestBody(request: PipelineRequest): Buffer {
	if (request.body === undefined || request.body === null) return Buffer.alloc(0);
	if (typeof request.body === "string") return Buffer.from(request.body);
	if (request.body instanceof ArrayBuffer) return Buffer.from(request.body);
	if (ArrayBuffer.isView(request.body)) {
		return Buffer.from(request.body.buffer, request.body.byteOffset, request.body.byteLength);
	}

	throw new Error("ACS email request body must be a string or byte buffer");
}

function resignRequest(
	request: PipelineRequest,
	accessKey: string,
	toleranceSeconds: number,
): void {
	const signedAt = new Date(Date.now() - toleranceSeconds * 1000).toUTCString();
	const contentHash = createHash("sha256").update(getRequestBody(request)).digest("base64");
	const url = new URL(request.url);
	const query = url.searchParams.toString();
	const pathAndQuery = query ? `${url.pathname}?${query}` : url.pathname;
	const host = request.headers.get("host") ?? url.host;
	const stringToSign = `${request.method.toUpperCase()}\n${pathAndQuery}\n${signedAt};${host};${contentHash}`;
	const signature = createHmac("sha256", Buffer.from(accessKey, "base64"))
		.update(stringToSign)
		.digest("base64");

	request.headers.set("x-ms-date", signedAt);
	request.headers.set("x-ms-content-sha256", contentHash);
	request.headers.set(
		"Authorization",
		`HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
	);
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
			return transport.sendRequest(request);
		},
	};

	return new EmailClient(connectionString, { httpClient });
}
