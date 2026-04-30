"use client";

import dynamic from "next/dynamic";

type RadarPoint = {
  label: string;
  maxLabel?: string;
  left: number;
  right: number;
  leftDisplay?: string;
  rightDisplay?: string;
};

type ComparisonRadarPanelProps = {
  data: RadarPoint[];
  leftLabel: string;
  rightLabel: string;
};

const ComparisonRadarChart = dynamic(
  () =>
    import("@/modules/comparacion/components/comparison-radar-chart").then(
      (mod) => mod.ComparisonRadarChart,
    ),
  { ssr: false },
);

export function ComparisonRadarPanel({
  data,
  leftLabel,
  rightLabel,
}: ComparisonRadarPanelProps) {
  return <ComparisonRadarChart data={data} leftLabel={leftLabel} rightLabel={rightLabel} />;
}
