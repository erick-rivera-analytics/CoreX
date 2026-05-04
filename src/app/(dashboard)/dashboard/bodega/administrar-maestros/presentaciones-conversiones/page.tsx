import {
  listCurrentBodegaPresentations,
  listCurrentBodegaProducts,
  listCurrentBodegaUnits,
} from "@/lib/bodega-masters";
import { BodegaPresentacionesPage } from "@/modules/bodega/components/bodega-presentaciones-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function BodegaPresentacionesConversionesPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/bodega/administrar-maestros/presentaciones-conversiones",
    loader: async () => {
      const [initialPresentations, initialProducts, initialUnits] = await Promise.all([
        listCurrentBodegaPresentations(),
        listCurrentBodegaProducts(),
        listCurrentBodegaUnits(),
      ]);

      return {
        initialPresentations,
        initialProducts,
        initialUnits,
      };
    },
    fallbackMessage: "No se pudo cargar el maestro de presentaciones de Bodega.",
    fallbackData: {
      initialPresentations: [],
      initialProducts: [],
      initialUnits: [],
    },
  });

  return (
    <BodegaPresentacionesPage
      initialPresentations={data?.initialPresentations ?? []}
      initialProducts={data?.initialProducts ?? []}
      initialUnits={data?.initialUnits ?? []}
      initialError={error}
    />
  );
}
