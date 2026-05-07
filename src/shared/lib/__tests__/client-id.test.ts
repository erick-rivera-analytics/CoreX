import { describe, expect, it, vi } from "vitest";

import { makeClientId } from "@/shared/lib/client-id";

describe("makeClientId", () => {
  it("usa crypto.randomUUID cuando está disponible (contexto seguro)", () => {
    const fakeId = "00000000-0000-0000-0000-aaaaaaaaaaaa";
    const spy = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(fakeId);

    const id = makeClientId();

    expect(spy).toHaveBeenCalledOnce();
    expect(id).toBe(fakeId);
    spy.mockRestore();
  });

  it("genera un fallback determinístico cuando randomUUID no existe (HTTP por IP)", () => {
    const original = globalThis.crypto?.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });

    const id1 = makeClientId("test");
    const id2 = makeClientId("test");

    // Debe arrancar con el prefijo, ser único entre llamadas y >= 16 chars.
    expect(id1.startsWith("test_")).toBe(true);
    expect(id2.startsWith("test_")).toBe(true);
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThanOrEqual(16);

    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: original,
      configurable: true,
    });
  });

  it("usa el prefijo 'ui' por defecto cuando no se pasa argumento", () => {
    const original = globalThis.crypto?.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });

    const id = makeClientId();
    expect(id.startsWith("ui_")).toBe(true);

    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: original,
      configurable: true,
    });
  });
});
