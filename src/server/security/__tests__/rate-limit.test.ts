import { describe, expect, it } from "vitest";

import {
  checkRateLimit,
  checkRequestRateLimit,
  getClientIdentity,
  resetRateLimit,
} from "@/server/security/rate-limit";

describe("rate limit helpers", () => {
  it("builds stable client identities from proxy headers", () => {
    const forwarded = new Request("https://corex.test", {
      headers: { "x-forwarded-for": "192.168.1.10, 10.0.0.2" },
    });
    const realIp = new Request("https://corex.test", {
      headers: { "x-real-ip": "10.0.0.8" },
    });

    expect(getClientIdentity(forwarded)).toBe("192.168.1.10");
    expect(getClientIdentity(realIp, "Erick.Rivera")).toBe("10.0.0.8:erick.rivera");
  });

  it("falls back safely when no proxy headers exist", () => {
    expect(getClientIdentity(new Request("https://corex.test"))).toBe("local");
  });

  it("blocks after the configured limit and can reset a key", () => {
    const key = "test:limit";
    resetRateLimit(key);

    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(false);

    resetRateLimit(key);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
  });

  it("scopes request limits by IP and suffix", () => {
    const request = new Request("https://corex.test", {
      headers: { "x-forwarded-for": "192.168.1.20" },
    });
    const key = "login:192.168.1.20:admin";
    resetRateLimit(key);

    expect(checkRequestRateLimit({
      request,
      scope: "login",
      suffix: "admin",
      limit: 1,
      windowMs: 60_000,
    }).allowed).toBe(true);
    expect(checkRequestRateLimit({
      request,
      scope: "login",
      suffix: "admin",
      limit: 1,
      windowMs: 60_000,
    }).allowed).toBe(false);
  });
});
