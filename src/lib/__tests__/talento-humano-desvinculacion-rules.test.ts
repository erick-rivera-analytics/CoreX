import { describe, expect, it } from "vitest";

import {
  RULES_CONSTANTS,
  classifyEstado,
  estadoMeta,
  estadoSeverityRank,
  isoWeekSubtract,
  isValidWeek,
  mannKendall,
  theilSenSlope,
  type WeekDatum,
} from "@/lib/talento-humano-desvinculacion-rules";

function mkWeek(
  isoWeekId: string,
  cumplimiento: number | null,
  totalHours = 45,
  rendRatio = 0.85,
): WeekDatum {
  return {
    isoWeekId,
    cumplimiento,
    totalActualHours: totalHours,
    actualHoursRend: totalHours * rendRatio,
  };
}

function buildWindow(
  startWeek: number,
  count: number,
  cumplimientosOrFn: Array<number | null> | ((i: number) => number | null),
  overrides: Partial<Record<number, { totalHours?: number; rendRatio?: number; cumplimiento?: number | null }>> = {},
): WeekDatum[] {
  return Array.from({ length: count }, (_, index) => {
    const weekNum = startWeek + index;
    const cumplimiento = typeof cumplimientosOrFn === "function"
      ? cumplimientosOrFn(index)
      : cumplimientosOrFn[index] ?? null;
    const override = overrides[index] ?? {};
    return mkWeek(
      `2026${String(weekNum).padStart(2, "0")}`,
      override.cumplimiento ?? cumplimiento ?? null,
      override.totalHours ?? 45,
      override.rendRatio ?? 0.85,
    );
  });
}

describe("isValidWeek", () => {
  it("válida con horas suficientes y H rend > 70 %", () => {
    expect(isValidWeek(mkWeek("202619", 0.95, 48, 0.80))).toBe(true);
  });
  it("inválida si total < 40 horas", () => {
    expect(isValidWeek(mkWeek("202619", 0.95, 30, 0.80))).toBe(false);
  });
  it("inválida si H rend ratio <= 70 %", () => {
    expect(isValidWeek(mkWeek("202619", 0.95, 45, 0.70))).toBe(false);
  });
  it("inválida si cumplimiento es null", () => {
    expect(isValidWeek(mkWeek("202619", null, 45, 0.80))).toBe(false);
  });
  it("inválida si total_actual_hours es 0", () => {
    expect(isValidWeek(mkWeek("202619", 0.95, 0, 0))).toBe(false);
  });
});

describe("mannKendall", () => {
  it("serie estrictamente creciente → Z > 0", () => {
    const result = mannKendall([0.5, 0.6, 0.7, 0.8, 0.9]);
    expect(result.s).toBeGreaterThan(0);
    expect(result.tau).toBeCloseTo(1, 6);
    expect(result.z).toBeGreaterThan(0);
  });
  it("serie estrictamente decreciente → Z < 0", () => {
    const result = mannKendall([1.2, 1.1, 1.0, 0.9, 0.8, 0.7]);
    expect(result.s).toBeLessThan(0);
    expect(result.tau).toBeCloseTo(-1, 6);
    expect(result.z).toBeLessThan(-1);
  });
  it("serie constante (ties absolutos) → s = 0, z = 0", () => {
    const result = mannKendall([1.0, 1.0, 1.0, 1.0]);
    expect(result.s).toBe(0);
    expect(result.tau).toBe(0);
    expect(result.z).toBe(0);
  });
  it("serie con un único punto → todo cero", () => {
    expect(mannKendall([0.5])).toEqual({ s: 0, tau: 0, z: 0, n: 1 });
  });
  it("Z bajo umbral canon en serie decreciente de 8 puntos", () => {
    const result = mannKendall([1.10, 1.05, 1.02, 0.98, 0.96, 0.92, 0.88, 0.85]);
    expect(result.z).toBeLessThan(RULES_CONSTANTS.MK_Z_DECLINE_THRESHOLD);
  });
  it("Z relajado captura decline noisy moderado (no caía con −1.0)", () => {
    // Serie con dirección decreciente pero noisy — pensada para caer
    // alrededor del umbral viejo. Con −0.5 debe disparar.
    const result = mannKendall([0.98, 1.0, 0.95, 0.97, 0.92, 0.94, 0.88]);
    expect(result.z).toBeLessThan(RULES_CONSTANTS.MK_Z_DECLINE_THRESHOLD);
  });
});

describe("theilSenSlope", () => {
  it("recta exacta y = 0.1·x → pendiente ≈ 0.1", () => {
    const slope = theilSenSlope([0.5, 0.6, 0.7, 0.8, 0.9]);
    expect(slope).toBeCloseTo(0.1, 6);
  });
  it("recta con outlier → mediana resiste", () => {
    // 0.5, 0.6, 0.7, 5.0 (outlier), 0.9 → mediana de pendientes resiste
    const slope = theilSenSlope([0.5, 0.6, 0.7, 5.0, 0.9]);
    expect(slope).toBeGreaterThan(0);
    expect(slope).toBeLessThan(0.5);
  });
  it("serie de 1 punto → null", () => {
    expect(theilSenSlope([0.5])).toBeNull();
  });
});

describe("isoWeekSubtract", () => {
  it("resta semanas sin cruce de año", () => {
    expect(isoWeekSubtract("202619", 5)).toBe("202614");
  });
  it("cruza año hacia atrás", () => {
    // 202602 - 12 cae en oct 2025 (semana 42)
    expect(isoWeekSubtract("202602", 12)).toBe("202542");
  });
  it("maneja años con 53 semanas (2020) cruzando frontera", () => {
    // 2020 tiene 53 semanas (Dec 31 2020 fue jueves).
    // 2021 W03 (lunes Jan 18 2021) − 4 semanas = lunes Dec 21 2020 = 2020 W52
    expect(isoWeekSubtract("202103", 4)).toBe("202052");
    // 2021 W03 − 5 semanas = lunes Dec 14 2020 = 2020 W51
    expect(isoWeekSubtract("202103", 5)).toBe("202051");
    // 2021 W01 − 1 semana = 2020 W53 (la semana extra de 2020)
    expect(isoWeekSubtract("202101", 1)).toBe("202053");
  });
  it("n = 0 devuelve la misma semana", () => {
    expect(isoWeekSubtract("202619", 0)).toBe("202619");
  });
  it("input mal formado se devuelve tal cual", () => {
    expect(isoWeekSubtract("abc", 1)).toBe("abc");
  });
  it("YYWW (4 dígitos) — formato canon del repo", () => {
    // "2619" = año 26 semana 19; 11 sem atrás = "2608"
    expect(isoWeekSubtract("2619", 11)).toBe("2608");
    // cruce de año: "2602" - 12 sem
    expect(isoWeekSubtract("2602", 12)).toBe("2542");
    // mismo formato out: 4-digit input → 4-digit output
    expect(isoWeekSubtract("2619", 5)).toBe("2614");
  });
  it("preserva formato del input (6 → 6, 4 → 4)", () => {
    expect(isoWeekSubtract("202619", 1)).toHaveLength(6);
    expect(isoWeekSubtract("2619", 1)).toHaveLength(4);
  });
});

describe("classifyEstado", () => {
  it("SALIDA: 10 sem válidas, decreciente, last < 90 %", () => {
    const window = buildWindow(10, 10, [1.15, 1.12, 1.08, 1.02, 0.98, 0.95, 0.90, 0.85, 0.82, 0.78]);
    const result = classifyEstado(window, "202619");
    expect(result.validWeeks).toBe(10);
    expect(result.lastIsValid).toBe(true);
    expect(result.lastCumplimiento).toBeCloseTo(0.78, 6);
    expect(result.isDeclining).toBe(true);
    expect(result.estado).toBe("salida");
    expect(estadoSeverityRank(result.estado)).toBe(1);
  });

  it("SALIDA: decline noisy moderado (umbral relajado lo captura)", () => {
    // Cumplimientos con declive moderado pero noisy: serie no monotónica.
    // Antes del relax (Z<−1.0) algunos quedaban fuera; ahora con MK<−0.5 OR
    // slope<−0.005 sí caen. Last < 90 %, ≥ 6 válidas.
    const window = buildWindow(10, 8, [1.02, 0.98, 1.00, 0.94, 0.96, 0.90, 0.92, 0.85]);
    const result = classifyEstado(window, "202617");
    expect(result.validWeeks).toBe(8);
    expect(result.lastIsValid).toBe(true);
    expect(result.lastCumplimiento).toBeCloseTo(0.85, 6);
    expect(result.isDeclining).toBe(true);
    expect(result.estado).toBe("salida");
  });

  it("ADVERTENCIA: 90–100 % + decreciente", () => {
    const window = buildWindow(10, 10, [1.15, 1.12, 1.08, 1.02, 1.00, 0.99, 0.97, 0.95, 0.93, 0.92]);
    const result = classifyEstado(window, "202619");
    expect(result.estado).toBe("advertencia");
  });

  it("BAJO sin tendencia: < 90 %, no decreciente", () => {
    const window = buildWindow(10, 10, [0.80, 0.85, 0.82, 0.88, 0.86, 0.84, 0.87, 0.85, 0.86, 0.85]);
    const result = classifyEstado(window, "202619");
    expect(result.estado).toBe("bajo_sin_tendencia");
  });

  it("CUMPLE_CON_CAIDA: ≥ 100 % pero declining", () => {
    const window = buildWindow(10, 10, [1.40, 1.35, 1.30, 1.25, 1.20, 1.15, 1.10, 1.08, 1.05, 1.02]);
    const result = classifyEstado(window, "202619");
    expect(result.isDeclining).toBe(true);
    expect(result.estado).toBe("cumple_con_caida");
  });

  it("OK: ≥ 90 % sin declinar", () => {
    const window = buildWindow(10, 10, [0.95, 1.00, 0.98, 1.02, 1.01, 0.99, 1.03, 1.01, 1.02, 1.00]);
    const result = classifyEstado(window, "202619");
    expect(result.estado).toBe("ok");
  });

  it("SIN_SENAL_ACTUAL: |V| ≥ 6 pero última semana inválida", () => {
    // Última semana con pocas horas → inválida
    const window = buildWindow(10, 10, [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.85], {
      9: { totalHours: 20 }, // inválida por horas
    });
    const result = classifyEstado(window, "202619");
    expect(result.lastIsValid).toBe(false);
    expect(result.estado).toBe("sin_senal_actual");
  });

  it("ADVERTENCIA_NUEVO: 4 válidas + last < 90", () => {
    // 8 semanas pero 4 inválidas por horas, las 4 válidas con cumplimiento bajo final
    const window = buildWindow(10, 8, [null, 1.0, null, 0.95, null, 0.92, null, 0.85], {
      0: { totalHours: 10 },
      2: { totalHours: 10 },
      4: { totalHours: 10 },
      6: { totalHours: 10 },
    });
    const result = classifyEstado(window, "202617");
    expect(result.validWeeks).toBe(4);
    expect(result.estado).toBe("advertencia_nuevo");
  });

  it("EN_OBSERVACION_NUEVO: 3 válidas, todas OK", () => {
    const window = buildWindow(10, 6, [1.0, null, 1.05, null, 1.02, null], {
      1: { totalHours: 10 },
      3: { totalHours: 10 },
      5: { totalHours: 10 },
    });
    const result = classifyEstado(window, "202614");
    expect(result.validWeeks).toBe(3);
    expect(result.estado).toBe("en_observacion_nuevo");
  });

  it("SIN_DATOS: < 2 válidas", () => {
    const window = buildWindow(10, 5, [null, null, null, null, 1.0], {
      0: { totalHours: 10 },
      1: { totalHours: 10 },
      2: { totalHours: 10 },
      3: { totalHours: 10 },
    });
    const result = classifyEstado(window, "202614");
    expect(result.validWeeks).toBe(1);
    expect(result.estado).toBe("sin_datos");
  });

  it("ventana desordenada se ordena ASC antes de evaluar", () => {
    const ordered = buildWindow(10, 6, [1.10, 1.05, 1.00, 0.95, 0.90, 0.85]);
    const shuffled = [ordered[3]!, ordered[0]!, ordered[5]!, ordered[1]!, ordered[2]!, ordered[4]!];
    const result = classifyEstado(shuffled, "202615");
    expect(result.estado).toBe("salida");
    expect(result.lastCumplimiento).toBeCloseTo(0.85, 6);
  });
});

describe("estadoMeta", () => {
  it("entrega badge variant y emoji por estado", () => {
    expect(estadoMeta("salida").badgeVariant).toBe("danger");
    expect(estadoMeta("salida").emoji).toBe("🔴");
    expect(estadoMeta("ok").badgeVariant).toBe("success");
    expect(estadoMeta("cumple_con_caida").badgeVariant).toBe("info");
    expect(estadoMeta("advertencia").badgeVariant).toBe("warning");
    expect(estadoMeta("sin_datos").badgeVariant).toBe("outline");
  });
});

describe("estadoSeverityRank", () => {
  it("salida es la severidad más alta (1)", () => {
    expect(estadoSeverityRank("salida")).toBe(1);
  });
  it("sin_datos es la severidad más baja (9)", () => {
    expect(estadoSeverityRank("sin_datos")).toBe(9);
  });
  it("ranking estricto entre categorías relevantes", () => {
    expect(estadoSeverityRank("salida")).toBeLessThan(estadoSeverityRank("advertencia"));
    expect(estadoSeverityRank("advertencia")).toBeLessThan(estadoSeverityRank("cumple_con_caida"));
    expect(estadoSeverityRank("cumple_con_caida")).toBeLessThan(estadoSeverityRank("ok"));
  });
});
