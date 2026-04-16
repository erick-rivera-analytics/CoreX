"use client";

import dynamic from "next/dynamic";

import type { MortalityCurvePoint } from "@/lib/mortality";

type MortalityCurvePanelProps = {
  data: MortalityCurvePoint[];
};

const MortalityCurveChart = dynamic(
  () =>
    import("@/modules/mortality/components/mortality-curve-chart").then(
      (mod) => mod.MortalityCurveChart,
    ),
  { ssr: false },
);

export function MortalityCurvePanel({ data }: MortalityCurvePanelProps) {
  return <MortalityCurveChart data={data} />;
}
