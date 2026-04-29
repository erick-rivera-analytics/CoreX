import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";
import { SeguimientosPage } from "@/modules/talento-humano/seguimientos/components/seguimientos-page";
import { loadFollowupCatalogs } from "@/lib/talento-humano-seguimientos-catalogs";
import { loadAssociatedWorkers, loadAreaOptions } from "@/lib/talento-humano-seguimientos-person";
import { loadFollowupDateOptions } from "@/lib/talento-humano-seguimientos-schedule";

export const dynamic = "force-dynamic";

async function loadBootData() {
  const [catalogs, associatedWorkers, areas, dateOptions] = await Promise.all([
    loadFollowupCatalogs().catch(() => ({})),
    loadAssociatedWorkers().catch(() => []),
    loadAreaOptions().catch(() => []),
    loadFollowupDateOptions().catch(() => ({ years: [], months: [] })),
  ]);
  return { catalogs, associatedWorkers, areas, dateOptions };
}

export default async function SeguimientosTrabajadoraSocialPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/talento-humano/seguimientos",
    loader: loadBootData,
    fallbackMessage: "No se pudo cargar el módulo de Seguimientos.",
  });

  if (!data) return <DashboardRouteError title="Seguimientos Trabajo Social" error={error} />;
  return (
    <SeguimientosPage
      initialCatalogs={data.catalogs}
      initialWorkers={data.associatedWorkers}
      initialAreas={data.areas}
      initialDateOptions={data.dateOptions}
    />
  );
}
