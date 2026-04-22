import { beforeEach, describe, expect, it } from "vitest";

import {
  buildHydratedDraftState,
  clearSolverDraft,
  getSolverDraftStorageKey,
  writeSolverDraft,
} from "@/modules/postcosecha/hooks/use-solver-draft-storage";
import type { PoscosechaClasificacionBootData } from "@/lib/postcosecha-clasificacion-en-blanco-types";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

const initialData: PoscosechaClasificacionBootData = {
  skuMaster: [
    {
      skuId: "sku-1",
      sku: "750X20MIN",
      pesoIdealBunch: 750,
      tallosMin: 20,
      tallosMax: 22,
      pesoMinObjetivo: 727.5,
      pesoMaxObjetivo: 772.5,
      maxGradosObjetivo: 3,
      validFrom: null,
      validTo: null,
      loadedAt: null,
      runId: null,
      actorId: null,
      changeReason: null,
    },
  ],
  ordersTemplate: [
    {
      skuId: "sku-1",
      sku: "750X20MIN",
      fecha_1: 0,
      fecha_2: 0,
      fecha_3: 0,
      fecha_4: 0,
      fecha_5: 0,
    },
  ],
  availabilityTemplate: [
    {
      grado: 40,
      pesoTalloSeed: 40,
      fecha_1: 0,
      fecha_2: 0,
      fecha_3: 0,
      fecha_4: 0,
      fecha_5: 0,
    },
  ],
  orderSlots: [
    { key: "fecha_1", restriction: null, restrictionMode: "SOFT" },
    { key: "fecha_2", restriction: null, restrictionMode: "SOFT" },
    { key: "fecha_3", restriction: null, restrictionMode: "SOFT" },
    { key: "fecha_4", restriction: null, restrictionMode: "SOFT" },
    { key: "fecha_5", restriction: null, restrictionMode: "SOFT" },
  ],
  lotSlots: [
    { key: "fecha_1", lotDate: null, origin: "GV" },
    { key: "fecha_2", lotDate: null, origin: "GV" },
    { key: "fecha_3", lotDate: null, origin: "GV" },
    { key: "fecha_4", lotDate: null, origin: "GV" },
    { key: "fecha_5", lotDate: null, origin: "GV" },
  ],
  settings: { desperdicio: 0.13 },
  metadata: {
    engine: "Python + PuLP",
    masterSource: "db",
    workbookPath: null,
    masterPath: null,
    usedFallbackDefaults: false,
  },
};

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: new MemoryStorage(),
    },
    configurable: true,
  });
});

describe("solver draft storage", () => {
  it("persiste y rehidrata el borrador del solver", () => {
    writeSolverDraft({
      orders: [
        { ...initialData.ordersTemplate[0], fecha_1: 12 },
      ],
      availability: [
        { ...initialData.availabilityTemplate[0], fecha_1: 6, pesoTalloSeed: 41.25 },
      ],
      settings: { desperdicio: 0.2 },
      orderSlots: [
        { key: "fecha_1", restriction: "GV", restrictionMode: "STRICT" },
      ],
      lotSlots: [
        { key: "fecha_1", lotDate: "2026-04-21", origin: "GV" },
      ],
      activeMode: "APERTURA",
      resultBundle: null,
      isResultStale: true,
    });

    const hydrated = buildHydratedDraftState(initialData);

    expect(hydrated?.orders[0]?.fecha_1).toBe(12);
    expect(hydrated?.availability[0]?.pesoTalloSeed).toBe(41.25);
    expect(hydrated?.settings.desperdicio).toBe(0.2);
    expect(hydrated?.activeMode).toBe("APERTURA");
    expect(hydrated?.isResultStale).toBe(true);
  });

  it("limpia el storage del solver", () => {
    writeSolverDraft({
      orders: initialData.ordersTemplate,
      availability: initialData.availabilityTemplate,
      settings: initialData.settings,
      orderSlots: initialData.orderSlots,
      lotSlots: initialData.lotSlots,
      activeMode: "GV",
      resultBundle: null,
      isResultStale: false,
    });

    clearSolverDraft();

    expect(window.localStorage.getItem(getSolverDraftStorageKey())).toBeNull();
  });
});
