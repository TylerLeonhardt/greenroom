import { PassThrough, Transform } from "node:stream";
import type { AppLoadContext, EntryContext } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { logger } from "~/services/logger.server";

const ABORT_DELAY = 5_000;

/**
 * Strips content after </html> to prevent React SSR comment markers (<!--$-->)
 * from appearing as visible text on iOS Safari.
 */
class StripAfterHtmlEnd extends Transform {
	private ended = false;

	_transform(
		chunk: Buffer,
		_encoding: BufferEncoding,
		callback: (error?: Error | null, data?: Buffer | string) => void,
	) {
		if (this.ended) {
			callback();
			return;
		}

		const str = chunk.toString();
		const idx = str.indexOf("</html>");
		if (idx !== -1) {
			this.ended = true;
			this.push(str.slice(0, idx + "</html>".length));
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
					const stripped = body.pipe(new StripAfterHtmlEnd());
					const stream = createReadableStreamFromReadable(stripped);

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
