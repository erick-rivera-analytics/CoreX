import { afterEach, describe, expect, it } from "vitest";

import { createToken, verifyToken } from "@/lib/auth";
import { resolveSessionSecret } from "@/lib/session-secret";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function setEnv(name: string, value: string) {
  process.env[name] = value;
}

describe("session secret and token rotation", () => {
  it("requires SESSION_SECRET in production", () => {
    setEnv("NODE_ENV", "production");
    delete process.env.SESSION_SECRET;

    expect(() => resolveSessionSecret()).toThrow("SESSION_SECRET es obligatorio");
  });

  it("rejects short production secrets", () => {
    setEnv("NODE_ENV", "production");
    process.env.SESSION_SECRET = "short";

    expect(() => resolveSessionSecret()).toThrow("al menos");
  });

  it("verifies tokens signed with the previous secret during rotation", () => {
    setEnv("NODE_ENV", "production");
    process.env.SESSION_SECRET = "a".repeat(40);

    const token = createToken("Erick.Rivera");

    process.env.SESSION_SECRET = "b".repeat(40);
    process.env.SESSION_SECRET_PREVIOUS = "a".repeat(40);

    expect(verifyToken(token)).toBe("erick.rivera");
  });

  it("derives a stable development secret when production is disabled", () => {
    setEnv("NODE_ENV", "development");
    delete process.env.SESSION_SECRET;

    const first = resolveSessionSecret();
    const second = resolveSessionSecret();

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(32);
  });
});
