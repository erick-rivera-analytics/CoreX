import {
  createEmptyBalanzasDashboardData,
  defaultBalanzasFilters,
  getBalanzasDashboardData,
} from "@/lib/postcosecha-balanzas";
import { BalanzasPage } from "@/modules/postcosecha/components/balanzas-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function BalanzasPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/postcosecha/balanzas",
    loader: () => getBalanzasDashboardData(defaultBalanzasFilters),
    fallbackMessage: "Error inesperado al consultar los indicadores de balanzas.",
    fallbackData: () => createEmptyBalanzasDashboardData(
      defaultBalanzasFilters,
      "No se pudo cargar Indicadores Balanzas.",
    ),
  });

  return <BalanzasPage initialData={data!} initialError={error} />;
}
