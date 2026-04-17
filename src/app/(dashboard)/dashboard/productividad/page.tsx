import { defaultProductividadFilters, getProductividadDashboardData } from "@/lib/productividad";
import { ProductividadPage } from "@/modules/productividad/components/productividad-page";
import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function ProductividadPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/productividad",
    loader: () => getProductividadDashboardData(defaultProductividadFilters),
    fallbackMessage: "Error inesperado al consultar PostgreSQL.",
  });

  if (!data) {
    return <DashboardRouteError title="No se pudo cargar el dashboard de productividad" error={error} />;
  }

  return <ProductividadPage initialData={data} />;
}
