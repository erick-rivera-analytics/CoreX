import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";
import { SimuladorVacacionesPage } from "@/modules/talento-humano/components/simulador-vacaciones-page";
import {
  getVacationSimulatorData,
  normalizeVacationFilters,
} from "@/lib/talento-humano-vacaciones";

export const dynamic = "force-dynamic";

export default async function SimuladorVacacionesRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/talento-humano/simulador-vacaciones",
    loader: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const filters = normalizeVacationFilters({ corteDate: today });
      return getVacationSimulatorData(filters);
    },
    fallbackMessage: "No se pudo cargar el simulador de vacaciones.",
  });

  if (!data) return <DashboardRouteError title="Simulador de Vacaciones" error={error} />;
  return <SimuladorVacacionesPage initialData={data} />;
}
