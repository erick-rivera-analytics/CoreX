import { getComparisonDashboardData } from "@/lib/comparacion";
import { ComparacionPage } from "@/modules/comparacion/components/comparacion-page";
import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function ComparacionPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/comparacion",
    loader: getComparisonDashboardData,
    fallbackMessage: "Error inesperado al consultar la comparacion de ciclos.",
  });

  if (!data) {
    return <DashboardRouteError title="No se pudo cargar la comparacion" error={error} />;
  }

  return <ComparacionPage initialData={data} />;
}
