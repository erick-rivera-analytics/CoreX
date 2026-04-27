import { describe, expect, it } from "vitest";

import {
  CALIDAD_CHART_COLORS,
  defaultPuntoAperturaFilters,
  normalizePuntoAperturaFilters,
} from "@/lib/calidad-punto-apertura";
import {
  buildStatusComposition,
} from "@/modules/calidad/components/punto-apertura-status-composition";
import type { PuntoAperturaRecord } from "@/lib/calidad-punto-apertura";

function makeRecord(overrides: Partial<PuntoAperturaRecord> = {}): PuntoAperturaRecord {
  return {
    id: "r1",
    fecha: "2024-01-01",
    bloque: "B1",
    ciclo: "C001",
    area: "Area A",
    spType: "SP1",
    month: "1",
    year: "2024",
    isoWeekId: "2024-01",
    totalApertura: 100,
    tallosMalla: null,
    dominanteClase: "Boton",
    dominanteValor: 60,
    dominantePct: 60,
    estado: "Homogeneo",
    apertura: { boton: 60, unoTres: 20, cuatroNueve: 10, diezVeinte: 5, masVeinte: 5 },
    participacion: { boton: 60, unoTres: 20, cuatroNueve: 10, diezVeinte: 5, masVeinte: 5 },
    ...overrides,
  };
}

// ─── normalizePuntoAperturaFilters ────────────────────────────────────────────

describe("normalizePuntoAperturaFilters", () => {
  it("returns all defaults when called with empty object", () => {
    const result = normalizePuntoAperturaFilters({});
    expect(result).toEqual(defaultPuntoAperturaFilters);
  });

  it("fills 'all' for missing optional fields", () => {
    const result = normalizePuntoAperturaFilters({ year: "2024" });
    expect(result.year).toBe("2024");
    expect(result.isoWeek).toBe("all");
    expect(result.area).toBe("all");
    expect(result.spType).toBe("all");
    expect(result.month).toBe("all");
    expect(result.date).toBe("");
    expect(result.dominantClass).toBe("all");
  });

  it("preserves provided filter values", () => {
    const result = normalizePuntoAperturaFilters({
      isoWeek: "2024-01",
      area: "Area A",
      spType: "SP1",
      month: "1",
      year: "2024",
      date: "2024-01-15",
      dominantClass: "Boton",
    });
    expect(result.isoWeek).toBe("2024-01");
    expect(result.area).toBe("Area A");
    expect(result.spType).toBe("SP1");
    expect(result.month).toBe("1");
    expect(result.date).toBe("2024-01-15");
  });

  it("normalizes null/undefined to 'all'", () => {
    const result = normalizePuntoAperturaFilters({ year: null as unknown as string, area: undefined });
    expect(result.year).toBe("all");
    expect(result.area).toBe("all");
  });

  it("trims whitespace from values", () => {
    const result = normalizePuntoAperturaFilters({ year: "  2024  " });
    expect(result.year).toBe("2024");
  });

  it("normalizes the exact day filter independently from select filters", () => {
    const result = normalizePuntoAperturaFilters({ date: " 2024-04-09T08:00:00 " as unknown as string });
    expect(result.date).toBe("2024-04-09");
    expect(result.month).toBe("all");
  });
});

// ─── buildStatusComposition ───────────────────────────────────────────────────

describe("buildStatusComposition", () => {
  it("returns zero totals for empty records array", () => {
    const result = buildStatusComposition([], "Homogeneo");
    expect(result.records).toBe(0);
    expect(result.total).toBe(0);
    expect(result.dominantTotal).toBe(0);
    expect(result.dominantPct).toBe(0);
  });

  it("filters by status — only homogeneos", () => {
    const records = [
      makeRecord({ estado: "Homogeneo", apertura: { boton: 50, unoTres: 10, cuatroNueve: 0, diezVeinte: 0, masVeinte: 0 } }),
      makeRecord({ estado: "No homogeneo", apertura: { boton: 10, unoTres: 5, cuatroNueve: 0, diezVeinte: 0, masVeinte: 0 } }),
    ];
    const result = buildStatusComposition(records, "Homogeneo");
    expect(result.records).toBe(1);
    expect(result.total).toBe(60);
  });

  it("filters by status — only no homogeneos", () => {
    const records = [
      makeRecord({ estado: "Homogeneo" }),
      makeRecord({ estado: "No homogeneo", apertura: { boton: 30, unoTres: 10, cuatroNueve: 0, diezVeinte: 0, masVeinte: 0 } }),
    ];
    const result = buildStatusComposition(records, "No homogeneo");
    expect(result.records).toBe(1);
    expect(result.total).toBe(40);
  });

  it("sums apertura correctly across multiple matching records", () => {
    const records = [
      makeRecord({ estado: "Homogeneo", apertura: { boton: 10, unoTres: 5, cuatroNueve: 0, diezVeinte: 0, masVeinte: 0 } }),
      makeRecord({ estado: "Homogeneo", apertura: { boton: 20, unoTres: 10, cuatroNueve: 5, diezVeinte: 0, masVeinte: 0 } }),
    ];
    const result = buildStatusComposition(records, "Homogeneo");
    expect(result.total).toBe(50);
    expect(result.items.find((item) => item.key === "boton")?.count).toBe(30);
    expect(result.items.find((item) => item.key === "unoTres")?.count).toBe(15);
  });

  it("calculates dominantPct correctly when total > 0", () => {
    const records = [
      makeRecord({
        estado: "Homogeneo",
        dominanteValor: 80,
        apertura: { boton: 80, unoTres: 20, cuatroNueve: 0, diezVeinte: 0, masVeinte: 0 },
      }),
    ];
    const result = buildStatusComposition(records, "Homogeneo");
    expect(result.dominantPct).toBeCloseTo(80, 1);
  });

  it("items array always contains exactly 5 apertura classes", () => {
    const result = buildStatusComposition([], "Homogeneo");
    expect(result.items).toHaveLength(5);
    const keys = result.items.map((item) => item.key);
    expect(keys).toEqual(["boton", "unoTres", "cuatroNueve", "diezVeinte", "masVeinte"]);
  });
});

// ─── CALIDAD_CHART_COLORS ─────────────────────────────────────────────────────

describe("CALIDAD_CHART_COLORS", () => {
  const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

  it("exposes status colors for homogeneous and nonHomogeneous", () => {
    expect(CALIDAD_CHART_COLORS.status).toHaveProperty("homogeneous");
    expect(CALIDAD_CHART_COLORS.status).toHaveProperty("nonHomogeneous");
    expect(CALIDAD_CHART_COLORS.status).toHaveProperty("homogeneousStroke");
    expect(CALIDAD_CHART_COLORS.status).toHaveProperty("nonHomogeneousStroke");
  });

  it("exposes referenceLine colors for mean and limit", () => {
    expect(CALIDAD_CHART_COLORS.referenceLine).toHaveProperty("mean");
    expect(CALIDAD_CHART_COLORS.referenceLine).toHaveProperty("limit");
  });

  it("all color values are valid 6-digit hex strings", () => {
    for (const color of Object.values(CALIDAD_CHART_COLORS.status)) {
      expect(color).toMatch(HEX_REGEX);
    }
    for (const color of Object.values(CALIDAD_CHART_COLORS.referenceLine)) {
      expect(color).toMatch(HEX_REGEX);
    }
  });

  it("homogeneous color is distinct from nonHomogeneous", () => {
    expect(CALIDAD_CHART_COLORS.status.homogeneous).not.toBe(CALIDAD_CHART_COLORS.status.nonHomogeneous);
  });

  it("referenceLine mean and limit are distinct", () => {
    expect(CALIDAD_CHART_COLORS.referenceLine.mean).not.toBe(CALIDAD_CHART_COLORS.referenceLine.limit);
  });
});
