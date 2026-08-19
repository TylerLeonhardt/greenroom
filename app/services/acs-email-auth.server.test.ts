import { createHash, createHmac } from "node:crypto";
import type { HttpClient, PipelineRequest } from "@azure/core-rest-pipeline";
import { describe, expect, it, vi } from "vitest";
import {
	createSkewTolerantEmailClient,
	DEFAULT_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS,
	parseEmailClockSkewToleranceSeconds,
} from "./acs-email-auth.server.js";

describe("ACS email clock-skew authentication", () => {
	it("backdates and re-signs the real SDK request so a skewed validator accepts it", async () => {
		vi.useFakeTimers();
		const serverNow = new Date("2026-08-19T19:33:00.000Z");
		const hostNow = new Date(serverNow.getTime() + 90_000);
		const validatorToleranceMs = 60_000;
		vi.setSystemTime(hostNow);

		const rawKey = "clock-skew-test-key";
		const accessKey = Buffer.from(rawKey).toString("base64");
		const connectionString = `endpoint=https://test.communication.azure.com/;accesskey=${accessKey}`;
		let capturedRequest: PipelineRequest | undefined;
		const transport: HttpClient = {
			async sendRequest(request) {
				capturedRequest = request;
				throw new Error("request captured");
			},
		};

		try {
			const client = createSkewTolerantEmailClient(
				connectionString,
				DEFAULT_EMAIL_CLOCK_SKEW_TOLERANCE_SECONDS,
				transport,
			);
			await expect(
				client.beginSend({
					senderAddress: "DoNotReply@mycalltime.app",
					content: { subject: "Clock skew test", html: "<p>Test</p>" },
					recipients: { to: [{ address: "test@example.com" }] },
				}),
			).rejects.toThrow("request captured");

			expect(capturedRequest).toBeDefined();
			const request = capturedRequest as PipelineRequest;
			const signedAt = new Date(request.headers.get("x-ms-date") ?? "");

			expect(Math.abs(hostNow.getTime() - serverNow.getTime())).toBeGreaterThan(
				validatorToleranceMs,
			);
			expect(signedAt.getTime() - serverNow.getTime()).toBe(30_000);
			expect(Math.abs(signedAt.getTime() - serverNow.getTime())).toBeLessThanOrEqual(
				validatorToleranceMs,
			);

			const body = typeof request.body === "string" ? request.body : "";
			const contentHash = createHash("sha256").update(body).digest("base64");
			expect(request.headers.get("x-ms-content-sha256")).toBe(contentHash);

			const url = new URL(request.url);
			const pathAndQuery = url.search ? `${url.pathname}${url.search}` : url.pathname;
			const host = request.headers.get("host") ?? url.host;
			const stringToSign =
				`${request.method.toUpperCase()}\n${pathAndQuery}\n` +
				`${signedAt.toUTCString()};${host};${contentHash}`;
			const expectedSignature = createHmac("sha256", rawKey).update(stringToSign).digest("base64");
			expect(request.headers.get("authorization")).toBe(
				`HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${expectedSignature}`,
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("uses a secure default and rejects excessive tolerance", () => {
		expect(parseEmailClockSkewToleranceSeconds(undefined)).toBe(60);
		expect(parseEmailClockSkewToleranceSeconds("30")).toBe(30);
		expect(() => parseEmailClockSkewToleranceSeconds("121")).toThrow("between 0 and 120");
		expect(() => parseEmailClockSkewToleranceSeconds("-1")).toThrow("must be an integer");
	});
});
