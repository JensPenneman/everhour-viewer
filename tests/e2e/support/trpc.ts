import { type Page } from "@playwright/test";

export type TrpcHandler = (input: unknown) => unknown;

/**
 * Mock tRPC procedures for the `httpBatchLink` wire format (no transformer):
 *
 *   queries:   GET  /api/trpc/a,b?batch=1&input={"0":...,"1":...}
 *   mutations: POST /api/trpc/a?batch=1   body {"0":...}
 *   response:  [{ "result": { "data": <output> } }, ...]   (procedure order)
 *
 * `handlers` is keyed by dotted procedure path (e.g. "timer.current"). Each
 * receives that call's input and returns its output. Unmocked procedures in a
 * batch resolve to `null`.
 */
export async function mockTrpc(page: Page, handlers: Record<string, TrpcHandler>): Promise<void> {
  await page.route(/\/api\/trpc\//, async (route) => {
    const url = new URL(route.request().url());
    const path = decodeURIComponent(url.pathname.split("/api/trpc/")[1] ?? "");
    const procs = path.split(",").filter(Boolean);

    let inputs: Record<string, unknown> = {};
    if (route.request().method() === "GET") {
      const raw = url.searchParams.get("input");
      if (raw) inputs = JSON.parse(raw) as Record<string, unknown>;
    } else {
      const body = route.request().postData();
      if (body) inputs = JSON.parse(body) as Record<string, unknown>;
    }

    const results = procs.map((proc, i) => {
      const handler = handlers[proc];
      return { result: { data: handler ? handler(inputs[String(i)]) : null } };
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results),
    });
  });
}
