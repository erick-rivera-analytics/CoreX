import { afterEach, describe, expect, it } from "vitest";

import {
  checkRateLimit,
  checkRequestRateLimit,
  getClientIdentity,
  resetRateLimit,
} from "@/server/security/rate-limit";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

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
    process.env = { ...process.env, NODE_ENV: "development" };
    expect(getClientIdentity(new Request("https://corex.test"))).toBe("local");
  });

  it("builds a deterministic production fallback identity when proxy headers are missing", () => {
    process.env = { ...process.env, NODE_ENV: "production" };

    const request = new Request("https://corex.test", {
      headers: {
        host: "corex.test",
        "user-agent": "Vitest",
        "accept-language": "es-EC",
      },
    });

    const clientKey = getClientIdentity(request);

    expect(clientKey).toMatch(/^fallback-[a-f0-9]{24}$/);
    expect(getClientIdentity(request, "Erick.Rivera")).toBe(`${clientKey}:erick.rivera`);
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
