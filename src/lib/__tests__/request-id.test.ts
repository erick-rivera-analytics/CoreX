import { describe, expect, it } from "vitest";

import { createRequestId, getRequestId } from "@/lib/request-id";

describe("requestId helpers", () => {
  it("createRequestId genera UUIDs distintos", () => {
    const a = createRequestId();
    const b = createRequestId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("getRequestId respeta el header x-request-id si está presente", () => {
    const req = new Request("http://localhost/x", {
      headers: { "x-request-id": "req-from-upstream" },
    });
    expect(getRequestId(req)).toBe("req-from-upstream");
  });

  it("getRequestId genera uno nuevo si el header está vacío o ausente", () => {
    const req = new Request("http://localhost/x");
    const id = getRequestId(req);
    expect(id).toMatch(/^[0-9a-f-]+$/i);
    expect(id.length).toBeGreaterThan(10);
  });

  it("getRequestId trim del header (rechaza espacios en blanco)", () => {
    const req = new Request("http://localhost/x", {
      headers: { "x-request-id": "   " },
    });
    const id = getRequestId(req);
    expect(id).not.toBe("   ");
    expect(id.length).toBeGreaterThan(10);
  });

  it("getRequestId sin argumento devuelve un UUID", () => {
    const id = getRequestId();
    expect(id).toMatch(/^[0-9a-f-]+$/i);
  });
});
