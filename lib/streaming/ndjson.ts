/**
 * NDJSON (newline-delimited JSON) reader/writer helpers.
 *
 * Used by the /api/sync streaming protocol: each event is one JSON object
 * on its own line, terminated by `\n`. This is simpler than full SSE and
 * lets the server back-pressure naturally via the underlying `ReadableStream`.
 */

/**
 * Write `event` as a single NDJSON line into `controller`.
 *
 * The line is `JSON.stringify(event) + "\n"`. Objects containing embedded
 * newlines are still valid because `JSON.stringify` escapes them.
 */
export function writeNdjsonLine<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: T,
  encoder: TextEncoder = sharedEncoder,
): void {
  controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
}

const sharedEncoder = new TextEncoder();

/**
 * Consume an NDJSON stream, calling `onEvent` for each parsed event.
 *
 * - Lines that fail to parse as JSON are skipped (with optional `onError`).
 * - The final, possibly-unterminated line is also yielded if it parses.
 * - Returns when the stream is done; throws if the stream errors. An exception
 *   thrown by `onEvent` itself (e.g. a handler signalling a fatal server event)
 *   propagates to the caller — only JSON parse failures are swallowed.
 */
export async function readNdjsonStream<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => void | Promise<void>,
  onError?: (line: string, error: unknown) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;
        await emit<T>(line, onEvent, onError);
      }
    }
    // Flush any trailing line (no trailing newline)
    buffer += decoder.decode();
    const trailing = buffer.trim();
    if (trailing) await emit<T>(trailing, onEvent, onError);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse one NDJSON line and hand it to `onEvent`. A JSON *parse* failure is
 * reported via `onError` and skipped; an error thrown by `onEvent` propagates
 * (so a handler can abort the stream on a fatal event).
 */
async function emit<T>(
  line: string,
  onEvent: (event: T) => void | Promise<void>,
  onError?: (line: string, error: unknown) => void,
): Promise<void> {
  let event: T;
  try {
    event = JSON.parse(line) as T;
  } catch (e) {
    onError?.(line, e);
    return;
  }
  await onEvent(event);
}
