// App Insights must be imported first to patch Node.js modules for auto-instrumentation
import "~/services/telemetry.server";
import { PassThrough, Transform } from "node:stream";
import type { AppLoadContext, EntryContext } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { logger } from "~/services/logger.server";

const ABORT_DELAY = 5_000;

function setSecurityHeaders(responseHeaders: Headers) {
	responseHeaders.set("X-Frame-Options", "DENY");
	responseHeaders.set("X-Content-Type-Options", "nosniff");
	responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
	responseHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
	responseHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	responseHeaders.set(
		"Content-Security-Policy-Report-Only",
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
	);
}

/**
 * Strips React SSR comment markers (<!--$-->, <!--/$-->) after </html>
 * to prevent them from appearing as visible text on iOS Safari, while
 * preserving <script> tags that Remix uses for streaming data delivery.
 *
 * Without preserving scripts, React hydration fails silently — the app
 * renders from SSR but interactive elements (onClick handlers, state)
 * never attach. See: https://github.com/TylerLeonhardt/greenroom/issues/42
 */
class StripSsrMarkers extends Transform {
	private afterHtml = false;

	_transform(
		chunk: Buffer,
		_encoding: BufferEncoding,
		callback: (error?: Error | null, data?: Buffer | string) => void,
	) {
		const str = chunk.toString();

		if (this.afterHtml) {
			// After </html>: strip SSR comment markers but keep <script> tags
			this.push(str.replace(/<!--\/?\$\s*-->/g, ""));
			callback();
			return;
		}

		const idx = str.indexOf("</html>");
		if (idx !== -1) {
			this.afterHtml = true;
			const before = str.slice(0, idx + "</html>".length);
			const after = str.slice(idx + "</html>".length);
			this.push(before + after.replace(/<!--\/?\$\s*-->/g, ""));
		} else {
			this.push(chunk);
		}
		callback();
	}
}

export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	_loadContext: AppLoadContext,
) {
	const start = Date.now();

	return isbot(request.headers.get("user-agent") || "")
		? handleBotRequest(request, responseStatusCode, responseHeaders, remixContext, start)
		: handleBrowserRequest(request, responseStatusCode, responseHeaders, remixContext, start);
}

function logRequest(request: Request, statusCode: number, startMs: number) {
	const url = new URL(request.url);
	logger.info(
		{
			method: request.method,
			path: url.pathname,
			status: statusCode,
			responseTime: Date.now() - startMs,
		},
		"request",
	);
}

function handleBotRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	startMs: number,
) {
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		const { pipe, abort } = renderToPipeableStream(
			<RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
			{
				onAllReady() {
					shellRendered = true;
					const body = new PassThrough();
					const stream = createReadableStreamFromReadable(body);

					setSecurityHeaders(responseHeaders);
					responseHeaders.set("Content-Type", "text/html");

					logRequest(request, responseStatusCode, startMs);
					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);

					pipe(body);
				},
				onShellError(error: unknown) {
					reject(error);
				},
				onError(error: unknown) {
					responseStatusCode = 500;
					if (shellRendered) {
						logger.error({ err: error }, "Streaming render error");
					}
				},
			},
		);

		setTimeout(abort, ABORT_DELAY);
	});
}

function handleBrowserRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	startMs: number,
) {
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		const { pipe, abort } = renderToPipeableStream(
			<RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
			{
				onAllReady() {
					shellRendered = true;
					const body = new PassThrough();
					const stripped = body.pipe(new StripSsrMarkers());
					const stream = createReadableStreamFromReadable(stripped);

					setSecurityHeaders(responseHeaders);
					responseHeaders.set("Content-Type", "text/html");

					logRequest(request, responseStatusCode, startMs);
					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);

					pipe(body);
				},
				onShellError(error: unknown) {
					reject(error);
				},
				onError(error: unknown) {
					responseStatusCode = 500;
					if (shellRendered) {
						logger.error({ err: error }, "Streaming render error");
					}
				},
			},
		);

		setTimeout(abort, ABORT_DELAY);
	});
}
