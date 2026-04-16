"use client";

import { ProductividadExplorer } from "@/modules/productividad/components/productividad-explorer";
import type { ProductividadDashboardData } from "@/lib/productividad";

export function ProductividadPage({ initialData }: { initialData: ProductividadDashboardData }) {
  return <ProductividadExplorer initialData={initialData} />;
}
