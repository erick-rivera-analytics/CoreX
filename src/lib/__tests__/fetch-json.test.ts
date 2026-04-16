import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJson } from "@/lib/fetch-json";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("returns parsed JSON for successful responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, count: 3 }),
    } as unknown as Response);

    await expect(fetchJson<{ ok: boolean; count: number }>("/api/test", "fallback")).resolves.toEqual({
      ok: true,
      count: 3,
    });
  });

  it("prefers API message/error payloads over fallback text", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: "mensaje api", error: "error api" }),
    } as unknown as Response);

    await expect(fetchJson("/api/test", "fallback")).rejects.toThrow("mensaje api");
  });

  it("keeps the fallback message when the response body is not JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockRejectedValue(new Error("invalid json")),
    } as unknown as Response);

    await expect(fetchJson("/api/test", "fallback definitivo")).rejects.toThrow("fallback definitivo");
  });
});
