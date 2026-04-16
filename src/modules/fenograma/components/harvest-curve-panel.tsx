"use client";

import dynamic from "next/dynamic";

import type { HarvestCurvePayload, HarvestCurvePoint } from "@/lib/fenograma";

type HarvestCurvePanelProps = {
  data: HarvestCurvePoint[];
  projectionStartDay: number | null;
  summary?: HarvestCurvePayload["summary"] | null;
};

const HarvestCurveChart = dynamic(
  () =>
    import("@/modules/fenograma/components/harvest-curve-chart").then(
      (mod) => mod.HarvestCurveChart,
    ),
  { ssr: false },
);

export function HarvestCurvePanel({
  data,
  projectionStartDay,
  summary,
}: HarvestCurvePanelProps) {
  return <HarvestCurveChart data={data} projectionStartDay={projectionStartDay} summary={summary} />;
}
