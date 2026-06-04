import { afterEach, describe, expect, it, vi } from "vitest";
import { submitWeekForApproval } from "@/server/everhour";
import { EverhourError } from "@/lib/everhour";

/**
 * `submitWeekForApproval` composes the composite timesheet id, POSTs to the
 * approval endpoint, and sanitises the `TimesheetApproval` response. We stub
 * `global.fetch` to assert the request shape and the sanitised result, plus
 * the permission-denied (4xx) path the limited production key may hit.
 */

interface Captured {
  url: string;
  method: string;
  body: unknown;
}

function stubFetch(status: number, responseBody: unknown): { captured: Captured | null } {
  const ref: { captured: Captured | null } = { captured: null };
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    ref.captured = {
      url: input.toString(),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    };
    return new Response(status === 204 ? "" : JSON.stringify(responseBody), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return ref;
}

afterEach(() => vi.unstubAllGlobals());

describe("submitWeekForApproval", () => {
  it("POSTs to /timesheets/{userId}{weekId}/approval and sanitises the response", async () => {
    const ref = stubFetch(200, {
      history: [{ action: "submitted", createdAt: "2026-06-04 09:00:00" }],
    });

    const result = await submitWeekForApproval({ key: "k", userId: 14856, weekId: 2535 });

    expect(ref.captured?.url).toBe("https://api.everhour.com/timesheets/148562535/approval");
    expect(ref.captured?.method).toBe("POST");
    expect(ref.captured?.body).toEqual({});

    expect(result).toEqual({
      status: "pending",
      submittedAt: "2026-06-04 09:00:00",
      history: [{ action: "submitted", createdAt: "2026-06-04 09:00:00" }],
    });
  });

  it("defaults to pending status when the response has no submitted history", async () => {
    stubFetch(200, {});
    const result = await submitWeekForApproval({ key: "k", userId: 1, weekId: 2 });
    expect(result.status).toBe("pending");
    expect(result.submittedAt).toBeNull();
    expect(result.history).toEqual([]);
  });

  it("surfaces a 403 (key lacks approval permission) as an EverhourError", async () => {
    stubFetch(403, { message: "forbidden" });
    await expect(submitWeekForApproval({ key: "k", userId: 1, weekId: 2 })).rejects.toMatchObject({
      name: "EverhourError",
      status: 403,
    });
  });

  it("does not retry a failed write (single attempt)", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return new Response("nope", { status: 403 });
    });
    await expect(submitWeekForApproval({ key: "k", userId: 1, weekId: 2 })).rejects.toBeInstanceOf(
      EverhourError,
    );
    expect(calls).toBe(1);
  });
});
