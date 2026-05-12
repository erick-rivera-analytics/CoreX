import { getQualityClaimDashboardPlanData } from "@/lib/calidad-reclamos-dashboard";
import { ReclamosDashboardPage } from "@/modules/calidad/components/reclamos-dashboard-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function CalidadReclamosPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/calidad/reclamos",
    loader: getQualityClaimDashboardPlanData,
    fallbackMessage: "No se pudo cargar el frente analítico de reclamos.",
    fallbackData: {
      visuals: [],
      notes: [],
    },
  });

  return <ReclamosDashboardPage initialData={data!} initialError={error} />;
}
