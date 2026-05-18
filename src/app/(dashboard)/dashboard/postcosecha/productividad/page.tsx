import {
  getPostharvestProductivityDashboardData,
} from "@/lib/postcosecha-productividad";
import { defaultPostharvestProductivityFilters } from "@/lib/postcosecha-productividad-contract";
import { PostcosechaProductividadPage } from "@/modules/postcosecha/components/postcosecha-productividad-page";
import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function PostcosechaProductividadPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/postcosecha/productividad",
    loader: () => getPostharvestProductivityDashboardData(defaultPostharvestProductivityFilters),
    fallbackMessage: "Error inesperado al consultar PostgreSQL.",
  });

  if (!data) {
    return (
      <DashboardRouteError
        title="No se pudo cargar el dashboard de productividad de postcosecha"
        error={error}
      />
    );
  }

  return <PostcosechaProductividadPage initialData={data} />;
}
