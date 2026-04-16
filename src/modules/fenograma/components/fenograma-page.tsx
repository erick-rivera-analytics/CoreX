"use client";

import { FenogramaExplorer } from "@/modules/fenograma/components/fenograma-explorer";
import type { FenogramaDashboardData } from "@/lib/fenograma";

export function FenogramaPage({ initialData }: { initialData: FenogramaDashboardData }) {
  return <FenogramaExplorer initialData={initialData} />;
}
