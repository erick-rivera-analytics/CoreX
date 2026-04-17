import { getCampoDashboardData } from "@/lib/campo";
import { CampoPage } from "@/modules/campo/components/campo-page";
import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function CampoPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/campo",
    loader: getCampoDashboardData,
    fallbackMessage: "Error inesperado al consultar el mapa de bloques.",
  });

  if (!data) {
    return <DashboardRouteError title="No se pudo cargar el mapa" error={error} />;
  }

  return <CampoPage initialData={data} />;
}
