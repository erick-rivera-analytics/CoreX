import { defaultFenogramaFilters, getFenogramaDashboardData } from "@/lib/fenograma";
import { FenogramaPage } from "@/modules/fenograma/components/fenograma-page";
import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function FenogramaPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/fenograma",
    loader: () => getFenogramaDashboardData(defaultFenogramaFilters),
    fallbackMessage: "Error inesperado al consultar PostgreSQL.",
  });

  if (!data) {
    return <DashboardRouteError title="No se pudo cargar el fenograma" error={error} />;
  }

  return <FenogramaPage initialData={data} />;
}
