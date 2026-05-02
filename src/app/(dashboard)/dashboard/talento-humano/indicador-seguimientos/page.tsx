import { SeguimientosIndicadorExplorer } from "@/modules/talento-humano/seguimientos/components/seguimientos-indicador-explorer";
import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";
import { defaultFollowupIndicatorFilters, loadFollowupIndicatorData } from "@/lib/talento-humano-seguimientos-indicador";

export const dynamic = "force-dynamic";

export default async function IndicadorSeguimientosPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/talento-humano/indicador-seguimientos",
    loader: () => loadFollowupIndicatorData(defaultFollowupIndicatorFilters),
    fallbackMessage: "No se pudo cargar el indicador de seguimientos.",
  });

  if (!data) return <DashboardRouteError title="Indicador de seguimientos" error={error} />;
  return <SeguimientosIndicadorExplorer initialData={data} />;
}
