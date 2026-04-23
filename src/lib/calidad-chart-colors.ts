// Documented exception: docs/ui-canon.md → Excepciones validas — .calidad-punto-apertura
// Recharts SVG renders outside the CSS tree — concrete hex values required.
// Kept in a separate client-safe file (no server imports) so chart components can import it.
export const CALIDAD_CHART_COLORS = {
  status: {
    homogeneous:          "#10b981",
    nonHomogeneous:       "#f59e0b",
    homogeneousStroke:    "#047857",
    nonHomogeneousStroke: "#b45309",
  },
  referenceLine: {
    mean:  "#0f766e",
    limit: "#dc2626",
  },
} as const;
