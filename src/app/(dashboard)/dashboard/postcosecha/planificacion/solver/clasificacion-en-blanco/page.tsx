import { getClasificacionEnBlancoBootData } from "@/lib/postcosecha-clasificacion-en-blanco";
import { ClasificacionEnBlancoPage } from "@/modules/postcosecha/components/clasificacion-en-blanco-page";
import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function ClasificacionEnBlancoPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco",
    loader: getClasificacionEnBlancoBootData,
    fallbackMessage: "No se pudo cargar la base de Clasificacion en blanco.",
  });

  if (!data) {
    return <DashboardRouteError title="No se pudo cargar Clasificacion en blanco" error={error} />;
  }

  return <ClasificacionEnBlancoPage initialData={data} initialError={error} />;
}
