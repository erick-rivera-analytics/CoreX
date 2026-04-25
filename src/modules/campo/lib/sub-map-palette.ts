/**
 * Paleta categórica para el sub-mapa de campo (Leaflet).
 *
 * IMPORTANTE: Leaflet exige valores hex literales en `L.PathOptions` (no acepta
 * `var(--…)`). Esta paleta queda intencionalmente como hex y es la **excepción
 * documentada** del canon de tokens — análoga a `programaciones-palettes.ts`.
 *
 * Si necesitás más colores, agregalos aquí en lugar de inline en componentes.
 */

/** 10 colores rotativos para válvulas (alta contraste). */
export const VALVE_COLORS = [
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#f97316",
] as const;

/** 28 colores rotativos para camas. Mantener orden estable para reproducibilidad. */
export const BED_COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#22c55e",
  "#e11d48",
  "#eab308",
  "#0ea5e9",
  "#d946ef",
  "#4ade80",
  "#fb923c",
  "#a78bfa",
  "#34d399",
  "#f87171",
  "#38bdf8",
  "#facc15",
  "#c084fc",
  "#86efac",
  "#fda4af",
  "#93c5fd",
  "#fcd34d",
] as const;

/** Color de relleno fallback para válvulas/camas sin color asignado. */
export const FALLBACK_FEATURE_FILL = "#c8d6dc";

/** Color de borde/línea para fallback en leyendas. */
export const FALLBACK_LEGEND_DOT = "#ccc";

/** Color base default para una válvula cuando no hay paleta. */
export const DEFAULT_VALVE_FILL = "#2563eb";

/** Fondo para insets/blocs de información en el mapa. */
export const MAP_INSET_BG = "#edf4ef";

/** Borde fino institucional para insets de mapa. */
export const MAP_INSET_BORDER = "#0f172a";

/** Verde institucional para acentos en insets. */
export const MAP_INSET_ACCENT = "#8fd4aa";
