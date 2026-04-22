import { describe, expect, it } from "vitest";

import { buildClasificacionPrecheck } from "@/lib/postcosecha-clasificacion-en-blanco-client";
import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionLotSlot,
  PoscosechaClasificacionOrderRow,
  PoscosechaClasificacionOrderSlot,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import type { PoscosechaSkuRecord } from "@/lib/postcosecha-sku-types";

const skuMaster: PoscosechaSkuRecord[] = [
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
];

const orders: PoscosechaClasificacionOrderRow[] = [
  {
    skuId: "sku-1",
    sku: "750X20MIN",
    fecha_1: 10,
    fecha_2: 5,
    fecha_3: 0,
    fecha_4: 0,
    fecha_5: 0,
  },
];

const availability: PoscosechaClasificacionAvailabilityRow[] = [
  {
    grado: 40,
    pesoTalloSeed: 40,
    fecha_1: 20,
    fecha_2: 10,
    fecha_3: 0,
    fecha_4: 0,
    fecha_5: 0,
  },
];

describe("postcosecha clasificacion precheck", () => {
  it("permite correr cuando hay mas disponibilidad que pedido", () => {
    const precheck = buildClasificacionPrecheck(orders, availability, skuMaster, 0.1);

    expect(precheck.isValid).toBe(true);
    expect(precheck.diferencia).toBeLessThan(0);
  });

  it("respeta slots STRICT por modo", () => {
    const orderSlots: PoscosechaClasificacionOrderSlot[] = [
      { key: "fecha_1", restriction: "GV", restrictionMode: "STRICT" },
      { key: "fecha_2", restriction: "APERTURA", restrictionMode: "STRICT" },
    ];
    const lotSlots: PoscosechaClasificacionLotSlot[] = [
      { key: "fecha_1", origin: "GV", lotDate: "2026-04-21" },
      { key: "fecha_2", origin: "APERTURA", lotDate: "2026-04-22" },
    ];

    const gvPrecheck = buildClasificacionPrecheck(
      orders,
      availability,
      skuMaster,
      0,
      orderSlots,
      lotSlots,
      "GV",
    );
    const aperturaPrecheck = buildClasificacionPrecheck(
      orders,
      availability,
      skuMaster,
      0,
      orderSlots,
      lotSlots,
      "APERTURA",
    );

    expect(gvPrecheck.tallosPedidos).toBe(200);
    expect(gvPrecheck.tallosDisponibles).toBe(400);
    expect(aperturaPrecheck.tallosPedidos).toBe(100);
    expect(aperturaPrecheck.tallosDisponibles).toBe(200);
  });

  it("permite slots SOFT sin bloquear fechas fuera de modo", () => {
    const orderSlots: PoscosechaClasificacionOrderSlot[] = [
      { key: "fecha_1", restriction: "GV", restrictionMode: "SOFT" },
      { key: "fecha_2", restriction: null, restrictionMode: "SOFT" },
    ];
    const lotSlots: PoscosechaClasificacionLotSlot[] = [
      { key: "fecha_1", origin: "GV", lotDate: "2026-04-21" },
      { key: "fecha_2", origin: "GV", lotDate: "2026-04-22" },
    ];

    const precheck = buildClasificacionPrecheck(
      orders,
      availability,
      skuMaster,
      0,
      orderSlots,
      lotSlots,
      "GV",
    );

    expect(precheck.tallosPedidos).toBe(300);
    expect(precheck.tallosDisponibles).toBe(600);
    expect(precheck.isValid).toBe(true);
  });
});
