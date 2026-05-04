import { listCurrentBodegaSourceActivities } from "@/lib/bodega-activity-source";
import {
  listCurrentBodegaCategories,
  listCurrentBodegaProducts,
  listCurrentBodegaUnits,
} from "@/lib/bodega-masters";
import { BodegaProductosPage } from "@/modules/bodega/components/bodega-productos-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function BodegaProductosMasterPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/bodega/administrar-maestros/productos",
    loader: async () => {
      const [initialProducts, initialUnits, initialCategories, initialActivities] = await Promise.all([
        listCurrentBodegaProducts(),
        listCurrentBodegaUnits(),
        listCurrentBodegaCategories(),
        listCurrentBodegaSourceActivities(),
      ]);

      return {
        initialProducts,
        initialUnits,
        initialCategories,
        initialActivities,
      };
    },
    fallbackMessage: "No se pudo cargar el maestro de productos de Bodega.",
    fallbackData: {
      initialProducts: [],
      initialUnits: [],
      initialCategories: [],
      initialActivities: [],
    },
  });

  return (
    <BodegaProductosPage
      initialProducts={data?.initialProducts ?? []}
      initialUnits={data?.initialUnits ?? []}
      initialCategories={data?.initialCategories ?? []}
      initialActivities={data?.initialActivities ?? []}
      initialError={error}
    />
  );
}
