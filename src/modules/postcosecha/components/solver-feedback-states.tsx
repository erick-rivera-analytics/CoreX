"use client";

import type { ReactNode } from "react";

import { MetricTile, type MetricTileAccent } from "@/shared/data-display/metric-tile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { cn } from "@/lib/utils";

/**
 * Wrapper intencional de MetricTile para el dominio del solver.
 * Traduce la API semántica `tone` (default/positive/warning) a la API visual
 * `accent` de MetricTile, evitando que los callers del solver dependan
 * directamente del enum `MetricTileAccent`.
 */
export function SolverMetricTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "positive" | "warning";
}) {
  const accentByTone: Record<typeof tone, MetricTileAccent> = {
    default: "default",
    positive: "success",
    warning: "warning",
  };

  return <MetricTile label={label} value={value} hint={hint} accent={accentByTone[tone]} />;
}

export function ResultStatusBadge({ status }: { status: string }) {
  const tone = status === "Dentro de objetivo"
    ? "border-chart-success-bold/45 bg-chart-success-bold/10 text-foreground"
    : status === "Sin resolver"
      ? "border-slate-500/45 bg-slate-500/12 text-foreground"
      : "border-slate-400/45 bg-slate-400/12 text-foreground";

  return (
    <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", tone)}>
      {status}
    </span>
  );
}

export function SimpleTableCard({
  title,
  description,
  table,
}: {
  title: string;
  description: string;
  table: ReactNode;
}) {
  return (
    <Card className="starter-panel border-border/70 bg-card/84">
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  );
}
