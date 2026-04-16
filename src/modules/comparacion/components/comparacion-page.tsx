"use client";

import { ComparisonExplorer } from "@/modules/comparacion/components/comparison-explorer";
import type { ComparisonDashboardData } from "@/lib/comparacion";

export function ComparacionPage({ initialData }: { initialData: ComparisonDashboardData }) {
  return <ComparisonExplorer initialData={initialData} />;
}
