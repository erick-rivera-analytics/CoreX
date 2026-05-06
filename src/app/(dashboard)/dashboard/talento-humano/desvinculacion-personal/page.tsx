import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";
import { TalentoDesvinculacionPage } from "@/modules/talento-humano/components/desvinculacion-page";
import { defaultTalentoExitFilters, getDesvinculacionData } from "@/lib/talento-humano";

export const dynamic = "force-dynamic";

export default async function DesvinculacionPersonalPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/talento-humano/desvinculacion-personal",
    loader: () => getDesvinculacionData(defaultTalentoExitFilters),
    fallbackMessage: "No se pudo cargar el modulo de desvinculacion personal.",
  });

  if (!data) return <DashboardRouteError title="Desvinculacion personal" error={error} />;
  return <TalentoDesvinculacionPage initialData={data} />;
}
