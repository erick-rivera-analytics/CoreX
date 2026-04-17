/**
 * Shared Recharts axis and grid configuration presets.
 * Import and spread into <XAxis>, <YAxis>, <CartesianGrid>.
 */

export const axisConfig = {
  axisLine: false,
  tickLine: false,
  tickMargin: 10,
} as const;

export const axisTickStyle = {
  fill: "var(--color-muted-foreground)",
  fontSize: 12,
} as const;

export const axisTickStyleCompact = {
  fill: "var(--color-muted-foreground)",
  fontSize: 10,
} as const;

export const gridConfig = {
  stroke: "var(--color-border)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

export const tooltipCursorStyle = {
  fill: "var(--color-muted)",
  opacity: 0.32,
} as const;
