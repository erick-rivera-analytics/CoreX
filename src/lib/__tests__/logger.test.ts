import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logEvent } from "@/lib/logger";

const originalLogLevel = process.env.LOG_LEVEL;
const originalLogFormat = process.env.LOG_FORMAT;

describe("logEvent — structured logger canon", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    process.env.LOG_LEVEL = originalLogLevel;
    process.env.LOG_FORMAT = originalLogFormat;
  });

  it("emite payload JSON cuando LOG_FORMAT=json", () => {
    process.env.LOG_LEVEL = "info";
    process.env.LOG_FORMAT = "json";

    logEvent("info", "auth.login", { username: "alice", requestId: "req_1" });

    expect(infoSpy).toHaveBeenCalledOnce();
    const arg = infoSpy.mock.calls[0]![0] as string;
    const payload = JSON.parse(arg) as Record<string, unknown>;
    expect(payload.level).toBe("info");
    expect(payload.event).toBe("auth.login");
    expect(payload.username).toBe("alice");
    expect(payload.requestId).toBe("req_1");
    expect(typeof payload.timestamp).toBe("string");
  });

  it("sanitiza claves sensibles (password, token, secret, cookie, authorization)", () => {
    process.env.LOG_LEVEL = "warn";
    process.env.LOG_FORMAT = "json";

    logEvent("warn", "auth.suspicious", {
      username: "bob",
      password: "leaked",
      sessionToken: "tok_xxx",
      apiSecret: "sec_yyy",
      cookieValue: "cookie",
      authorization: "Bearer xxx",
      safe: "ok",
    });

    expect(warnSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(warnSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(payload.username).toBe("bob");
    expect(payload.safe).toBe("ok");
    expect(payload.password).toBeUndefined();
    expect(payload.sessionToken).toBeUndefined();
    expect(payload.apiSecret).toBeUndefined();
    expect(payload.cookieValue).toBeUndefined();
    expect(payload.authorization).toBeUndefined();
  });

  it("omite eventos por debajo del LOG_LEVEL configurado", () => {
    process.env.LOG_LEVEL = "warn";
    process.env.LOG_FORMAT = "json";

    logEvent("info", "metric.tick", { count: 1 });
    logEvent("debug", "noisy.trace", { count: 1 });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("permite todos los niveles cuando LOG_LEVEL=debug", () => {
    process.env.LOG_LEVEL = "debug";
    process.env.LOG_FORMAT = "json";

    logEvent("debug", "trace.event");
    logEvent("info", "info.event");
    logEvent("warn", "warn.event");
    logEvent("error", "error.event");

    expect(infoSpy).toHaveBeenCalledTimes(2); // debug + info se enrutan a console.info
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("usa formato pretty cuando LOG_FORMAT no es json", () => {
    process.env.LOG_LEVEL = "info";
    delete process.env.LOG_FORMAT;

    logEvent("info", "ui.click", { target: "button" });

    expect(infoSpy).toHaveBeenCalledOnce();
    const args = infoSpy.mock.calls[0]!;
    expect(args[0]).toContain("[INFO]");
    expect(args[0]).toContain("ui.click");
  });
});
