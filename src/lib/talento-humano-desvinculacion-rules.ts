/**
 * Reglas de clasificación de estado para la Herramienta de Desvinculación.
 *
 * IMPORTANTE: este archivo solo expone funciones puras + constantes. No
 * importa `server-only`, no consulta DB, no usa React. Es testeable de forma
 * aislada y consumible tanto desde server libs como desde componentes
 * cliente.
 *
 * El veredicto FINAL para un colaborador (`DesvinculacionEstado`) combina:
 *  1. Sufficiency check: ≥ 50 % de la ventana (≥ 6 de 12 sem) debe ser válida
 *     para considerarse "establecido"; entre 2 y 5 semanas válidas se trata
 *     como "nuevo"; menos de 2 → "sin datos".
 *  2. Validez puntual de la última semana (la del filtro) — sin eso no
 *     podemos juzgar el momento actual.
 *  3. Tendencia robusta (Mann-Kendall sobre las válidas, con Z < −1.0).
 *  4. Umbral absoluto sobre el cumplimiento de la última semana válida.
 *
 * Mann-Kendall y Theil-Sen son no-paramétricos y resistentes a outliers,
 * el estándar para series cortas (5–12 puntos).
 */

export const RULES_CONSTANTS = {
  /** Ancho de la ventana de análisis (en semanas, contando la última). */
  WINDOW_WEEKS: 12,
  /** Umbral mínimo de horas presenciales (total_actual_hours) por semana válida. */
  MIN_HOURS_PRESENCIALES: 40,
  /** Umbral mínimo de ratio H rend (actual_hours_rend / total_actual_hours). */
  MIN_H_REND_RATIO: 0.70,
  /** Semanas válidas necesarias para considerarse "establecido". */
  MIN_VALID_FOR_ESTABLISHED: 6,
  /** Semanas válidas mínimas para correr Mann-Kendall con potencia razonable. */
  MIN_VALID_FOR_ANY_TREND: 4,
  /** Semanas válidas mínimas para emitir veredicto "nuevo" en lugar de "sin datos". */
  MIN_VALID_FOR_NEWBIE: 2,
  /**
   * Z de Mann-Kendall por debajo del cual decimos "tendencia decreciente".
   * Se relajó de −1.0 (~84 %) a −0.5 (~69 % one-sided) tras detectar que
   * casi nadie caía en SALIDA con el umbral estricto — la decisión final
   * sigue requiriendo cumplimiento < 90 % en la semana actual válida, así
   * que el doble filtro mantiene la rigurosidad.
   */
  MK_Z_DECLINE_THRESHOLD: -0.5,
  /**
   * Pendiente Theil-Sen (en unidades de cumplimiento por semana) por debajo
   * de la cual la magnitud de la caída se considera relevante por sí sola.
   * −0.005 ≡ caída de 0.5 pp/sem ≡ 6 pp en 12 semanas. Combinada con MK vía
   * `OR`, captura tanto declines consistentes-pero-noisy como declines
   * suaves-pero-de-magnitud-clara.
   */
  SLOPE_DECLINE_THRESHOLD: -0.005,
  /** Umbral de cumplimiento bajo (escala 0..1+). */
  CUMPLIMIENTO_LOW: 0.90,
  /** Umbral de cumplimiento objetivo (escala 0..1+). */
  CUMPLIMIENTO_TARGET: 1.00,
} as const;

export type DesvinculacionEstado =
  | "salida"
  | "advertencia"
  | "bajo_sin_tendencia"
  | "advertencia_nuevo"
  | "cumple_con_caida"
  | "en_observacion_nuevo"
  | "ok"
  | "sin_senal_actual"
  | "sin_datos";

export type WeekDatum = {
  isoWeekId: string;
  cumplimiento: number | null;
  actualHoursRend: number;
  totalActualHours: number;
};

export type MannKendallResult = {
  s: number;
  tau: number;
  z: number;
  n: number;
};

export type EstadoClassification = {
  estado: DesvinculacionEstado;
  validWeeks: number;
  totalWeeks: number;
  lastIsValid: boolean;
  lastCumplimiento: number | null;
  mannKendall: MannKendallResult | null;
  theilSenSlope: number | null;
  isDeclining: boolean;
};

export type EstadoMeta = {
  label: string;
  emoji: string;
  badgeVariant: "danger" | "warning" | "info" | "success" | "outline" | "secondary";
  description: string;
};

// ── Helpers de ventana / validez ─────────────────────────────────────────────

export function isValidWeek(week: WeekDatum): boolean {
  if (week.totalActualHours < RULES_CONSTANTS.MIN_HOURS_PRESENCIALES) return false;
  if (week.totalActualHours <= 0) return false;
  const ratio = week.actualHoursRend / week.totalActualHours;
  if (ratio <= RULES_CONSTANTS.MIN_H_REND_RATIO) return false;
  if (week.cumplimiento === null || !Number.isFinite(week.cumplimiento)) return false;
  return true;
}

// ── Mann-Kendall (con corrección de continuidad y ties) ──────────────────────

function sign(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

export function mannKendall(values: number[]): MannKendallResult {
  const n = values.length;
  if (n < 2) return { s: 0, tau: 0, z: 0, n };

  let s = 0;
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      s += sign(values[j]! - values[i]!);
    }
  }

  // Tie correction: Var(S) = [n(n-1)(2n+5) - Σ t_g(t_g-1)(2t_g+5)] / 18
  const tieCounts = new Map<number, number>();
  for (const value of values) {
    tieCounts.set(value, (tieCounts.get(value) ?? 0) + 1);
  }
  let tieSum = 0;
  for (const count of tieCounts.values()) {
    if (count > 1) tieSum += count * (count - 1) * (2 * count + 5);
  }
  const variance = (n * (n - 1) * (2 * n + 5) - tieSum) / 18;

  // Continuity correction: Z = (S − sign(S)) / √Var(S)
  let z = 0;
  if (variance > 0 && s !== 0) {
    z = (s - sign(s)) / Math.sqrt(variance);
  }

  const tau = (n * (n - 1) / 2) > 0 ? s / (n * (n - 1) / 2) : 0;

  return { s, tau, z, n };
}

// ── Theil-Sen slope ──────────────────────────────────────────────────────────

export function theilSenSlope(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      slopes.push((values[j]! - values[i]!) / (j - i));
    }
  }
  if (slopes.length === 0) return null;
  slopes.sort((a, b) => a - b);
  const mid = slopes.length >> 1;
  if (slopes.length % 2 === 1) return slopes[mid] ?? null;
  return ((slopes[mid - 1] ?? 0) + (slopes[mid] ?? 0)) / 2;
}

// ── ISO week arithmetic (YYYYWW de 6 dígitos) ────────────────────────────────

function isoWeekMonday(year: number, week: number): Date {
  // ISO 8601: la semana 1 contiene el primer jueves del año (equivalente:
  // contiene el 4 de enero). El lunes de la semana 1 es el lunes anterior
  // o igual al 4 de enero.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1..7 (lunes=1, domingo=7)
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
}

function dateToIsoWeek(date: Date): { year: number; week: number } {
  // El año ISO de una fecha se determina por el jueves de su semana.
  // Trasladamos `date` al jueves de su semana (días 1..7).
  const day = date.getUTCDay() || 7; // 1..7
  const thursday = new Date(date.getTime() + (4 - day) * 86400000);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const diffDays = Math.round((thursday.getTime() - week1Monday.getTime()) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return { year, week };
}

/**
 * Resta `n` semanas a un `weekId` en formato `YYYYWW` (6 dígitos).
 * Maneja cruces de año y años de 53 semanas (p. ej. 2020).
 *
 * Ejemplos:
 *   isoWeekSubtract("202602", 12) → "202542"
 *   isoWeekSubtract("202103", 4)  → "202053"   // 2020 tiene 53 semanas
 */
export function isoWeekSubtract(weekId6: string, n: number): string {
  const match = weekId6.match(/^(\d{4})(\d{2})$/);
  if (!match) return weekId6;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const monday = isoWeekMonday(year, week);
  const shifted = new Date(monday.getTime() - n * 7 * 86400000);
  const result = dateToIsoWeek(shifted);
  return `${result.year}${String(result.week).padStart(2, "0")}`;
}

// ── Clasificación principal ──────────────────────────────────────────────────

export function classifyEstado(
  windowData: WeekDatum[],
  lastWeekId: string,
): EstadoClassification {
  // El cliente puede pasar las semanas desordenadas o con gaps; orden ASC.
  const sorted = [...windowData].sort((a, b) => a.isoWeekId.localeCompare(b.isoWeekId));
  const validList = sorted.filter(isValidWeek);
  const validWeeks = validList.length;
  const totalWeeks = sorted.length;

  const last = sorted.find((week) => week.isoWeekId === lastWeekId) ?? null;
  const lastIsValid = last !== null && isValidWeek(last);
  const lastCumplimiento = last?.cumplimiento ?? null;

  // Mann-Kendall + Theil-Sen sobre cumplimientos de semanas válidas.
  const validCumplimientos = validList
    .map((week) => week.cumplimiento)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const mk: MannKendallResult | null = validCumplimientos.length >= RULES_CONSTANTS.MIN_VALID_FOR_ANY_TREND
    ? mannKendall(validCumplimientos)
    : null;
  const slope = validCumplimientos.length >= 2 ? theilSenSlope(validCumplimientos) : null;
  // `isDeclining` se dispara con dos señales (OR):
  //  - MK Z < −0.5 (consistencia direccional aunque la magnitud sea baja), o
  //  - Theil-Sen slope < −0.005 (magnitud relevante aunque la serie sea noisy).
  // Solo se evalúa con ≥ 4 semanas válidas para mantener potencia razonable.
  const mkDeclines = mk !== null && mk.z < RULES_CONSTANTS.MK_Z_DECLINE_THRESHOLD;
  const slopeDeclines = slope !== null
    && slope < RULES_CONSTANTS.SLOPE_DECLINE_THRESHOLD
    && validCumplimientos.length >= RULES_CONSTANTS.MIN_VALID_FOR_ANY_TREND;
  const isDeclining = mkDeclines || slopeDeclines;

  const estado = decideEstado({
    validWeeks,
    lastIsValid,
    lastCumplimiento,
    isDeclining,
  });

  return {
    estado,
    validWeeks,
    totalWeeks,
    lastIsValid,
    lastCumplimiento,
    mannKendall: mk,
    theilSenSlope: slope,
    isDeclining,
  };
}

function decideEstado({
  validWeeks,
  lastIsValid,
  lastCumplimiento,
  isDeclining,
}: {
  validWeeks: number;
  lastIsValid: boolean;
  lastCumplimiento: number | null;
  isDeclining: boolean;
}): DesvinculacionEstado {
  const { MIN_VALID_FOR_NEWBIE, MIN_VALID_FOR_ESTABLISHED, CUMPLIMIENTO_LOW, CUMPLIMIENTO_TARGET } = RULES_CONSTANTS;

  // Sin datos suficientes para decidir nada.
  if (validWeeks < MIN_VALID_FOR_NEWBIE) return "sin_datos";

  // "Nuevito": entre 2 y 5 válidas. No corremos veredicto pesado.
  if (validWeeks < MIN_VALID_FOR_ESTABLISHED) {
    if (lastIsValid && lastCumplimiento !== null && lastCumplimiento < CUMPLIMIENTO_LOW) {
      return "advertencia_nuevo";
    }
    return "en_observacion_nuevo";
  }

  // "Establecido": ≥ 6 válidas. Aplican las reglas plenas.
  if (!lastIsValid) return "sin_senal_actual";

  // lastCumplimiento puede ser null si la semana actual no tiene rendimiento;
  // tratada como caso degenerado → "sin señal" para no inventar.
  if (lastCumplimiento === null || !Number.isFinite(lastCumplimiento)) {
    return "sin_senal_actual";
  }

  if (lastCumplimiento < CUMPLIMIENTO_LOW) {
    return isDeclining ? "salida" : "bajo_sin_tendencia";
  }
  if (lastCumplimiento < CUMPLIMIENTO_TARGET) {
    return isDeclining ? "advertencia" : "ok";
  }
  // lastCumplimiento >= 1.00
  return isDeclining ? "cumple_con_caida" : "ok";
}

// ── Metadata por estado (label, emoji, variant, descripción) ─────────────────

const ESTADO_META: Record<DesvinculacionEstado, EstadoMeta> = {
  salida: {
    label: "Salida",
    emoji: "🔴",
    badgeVariant: "danger",
    description: "Cumplimiento < 90 % con tendencia decreciente significativa. Candidato a revisión inmediata.",
  },
  advertencia: {
    label: "Advertencia",
    emoji: "🟠",
    badgeVariant: "warning",
    description: "Cumplimiento 90–100 % con tendencia decreciente. Iniciar plan de acompañamiento.",
  },
  bajo_sin_tendencia: {
    label: "Bajo crónico",
    emoji: "🟠",
    badgeVariant: "warning",
    description: "Cumplimiento < 90 % sin tendencia descendente clara. Bajo desempeño sostenido — plan de mejora.",
  },
  advertencia_nuevo: {
    label: "Advertencia (nuevo)",
    emoji: "🟡",
    badgeVariant: "warning",
    description: "Pocos datos válidos (< 6 semanas) y cumplimiento bajo en última semana válida.",
  },
  cumple_con_caida: {
    label: "Cumple con caída",
    emoji: "🔵",
    badgeVariant: "info",
    description: "Cumplimiento ≥ 100 % pero la tendencia 12 sem es decreciente. Señal temprana de deterioro.",
  },
  en_observacion_nuevo: {
    label: "En observación (nuevo)",
    emoji: "🆕",
    badgeVariant: "secondary",
    description: "Menos de 6 semanas válidas. Sin patrón consolidado todavía.",
  },
  ok: {
    label: "OK",
    emoji: "🟢",
    badgeVariant: "success",
    description: "Cumplimiento dentro o sobre umbral con tendencia estable o creciente.",
  },
  sin_senal_actual: {
    label: "Sin señal actual",
    emoji: "◻️",
    badgeVariant: "outline",
    description: "La semana actual no es válida (pocas horas o H rend < 70 %). No se puede juzgar el momento.",
  },
  sin_datos: {
    label: "Sin datos",
    emoji: "⚪",
    badgeVariant: "outline",
    description: "Menos de 2 semanas válidas en la ventana — sin base para análisis.",
  },
};

export function estadoMeta(estado: DesvinculacionEstado): EstadoMeta {
  return ESTADO_META[estado];
}

const SEVERITY_RANK: Record<DesvinculacionEstado, number> = {
  salida: 1,
  advertencia: 2,
  advertencia_nuevo: 3,
  bajo_sin_tendencia: 4,
  cumple_con_caida: 5,
  en_observacion_nuevo: 6,
  ok: 7,
  sin_senal_actual: 8,
  sin_datos: 9,
};

export function estadoSeverityRank(estado: DesvinculacionEstado): number {
  return SEVERITY_RANK[estado];
}
