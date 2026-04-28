import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";
import { SeguimientosPage } from "@/modules/talento-humano/seguimientos/components/seguimientos-page";
import { loadFollowupCatalogs } from "@/lib/talento-humano-seguimientos-catalogs";
import { loadAssociatedWorkers } from "@/lib/talento-humano-seguimientos-person";

export const dynamic = "force-dynamic";

async function loadBootData() {
  const [catalogs, associatedWorkers] = await Promise.all([
    loadFollowupCatalogs().catch(() => ({})),
    loadAssociatedWorkers().catch(() => []),
  ]);
  return { catalogs, associatedWorkers };
}

export default async function SeguimientosTrabajadoraSocialPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/talento-humano/seguimientos",
    loader: loadBootData,
    fallbackMessage: "No se pudo cargar el módulo de Seguimientos.",
  });

  if (!data) return <DashboardRouteError title="Seguimientos Trabajo Social" error={error} />;
  return <SeguimientosPage initialCatalogs={data.catalogs} initialWorkers={data.associatedWorkers} />;
}
