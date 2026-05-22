import { describe, it, expect } from "vitest";
import { readNdjsonStream, writeNdjsonLine } from "@/lib/streaming/ndjson";

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe("readNdjsonStream", () => {
  it("yields one event per line", async () => {
    const events: number[] = [];
    await readNdjsonStream<{ n: number }>(streamOf('{"n":1}\n{"n":2}\n{"n":3}\n'), (e) => {
      events.push(e.n);
    });
    expect(events).toEqual([1, 2, 3]);
  });

  it("yields a trailing line without a final newline", async () => {
    const events: number[] = [];
    await readNdjsonStream<{ n: number }>(streamOf('{"n":1}\n{"n":2}'), (e) => {
      events.push(e.n);
    });
    expect(events).toEqual([1, 2]);
  });

  it("skips invalid JSON lines and calls onError for each", async () => {
    const got: number[] = [];
    const errs: string[] = [];
    await readNdjsonStream<{ n: number }>(
      streamOf('{"n":1}\nnot json\n{"n":2}\n'),
      (e) => {
        got.push(e.n);
      },
      (line) => {
        errs.push(line);
      },
    );
    expect(got).toEqual([1, 2]);
    expect(errs).toEqual(["not json"]);
  });

  it("ignores blank lines", async () => {
    const got: number[] = [];
    await readNdjsonStream<{ n: number }>(streamOf('\n\n{"n":1}\n\n'), (e) => {
      got.push(e.n);
    });
    expect(got).toEqual([1]);
  });
});

describe("writeNdjsonLine", () => {
  it("encodes JSON followed by a newline", async () => {
    const chunks: Uint8Array[] = [];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        writeNdjsonLine(controller, { n: 1 });
        writeNdjsonLine(controller, { n: 2 });
        controller.close();
      },
    });
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const text = new TextDecoder().decode(new Uint8Array(chunks.flatMap((c) => Array.from(c))));
    expect(text).toBe('{"n":1}\n{"n":2}\n');
  });
});
