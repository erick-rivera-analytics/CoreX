"use client";

import { CampoExplorer } from "@/modules/campo/components/campo-explorer";
import type { CampoDashboardData } from "@/lib/campo";

export function CampoPage({ initialData }: { initialData: CampoDashboardData }) {
  return <CampoExplorer initialData={initialData} />;
}
