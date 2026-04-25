import type { CampoDrenchProductRecord } from "@/lib/campo-drench-product-types";
import { CampoDrenchProductsExplorer } from "@/modules/campo/components/drench-products-explorer";

export function CampoDrenchProductsPage({
  initialData,
  initialError,
}: {
  initialData: CampoDrenchProductRecord[];
  initialError?: string | null;
}) {
  return <CampoDrenchProductsExplorer initialData={initialData} initialError={initialError} />;
}
