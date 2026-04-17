import { defaultMortalityFilters, getMortalityDashboardData } from "@/lib/mortality";
import { MortalityPage } from "@/modules/mortality/components/mortality-page";
import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function MortalityPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/mortality",
    loader: () => getMortalityDashboardData(defaultMortalityFilters),
    fallbackMessage: "Error inesperado al consultar PostgreSQL.",
  });

  if (!data) {
    return <DashboardRouteError title="No se pudo cargar el dashboard de mortandades" error={error} />;
  }

  return <MortalityPage initialData={data} />;
}
