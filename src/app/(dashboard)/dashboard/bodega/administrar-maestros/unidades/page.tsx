import { listCurrentBodegaUnits } from "@/lib/bodega-masters";
import { BodegaUnidadesPage } from "@/modules/bodega/components/bodega-unidades-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function BodegaUnidadesRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/bodega/administrar-maestros/unidades",
    loader: listCurrentBodegaUnits,
    fallbackMessage: "No se pudo cargar el maestro de unidades de Bodega.",
    fallbackData: [],
  });

  return <BodegaUnidadesPage initialData={data ?? []} initialError={error} />;
}
