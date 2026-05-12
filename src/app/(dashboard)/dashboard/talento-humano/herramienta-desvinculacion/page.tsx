import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";
import { HerramientaDesvinculacionPage } from "@/modules/talento-humano/components/herramienta-desvinculacion-page";
import {
  getDesvinculacionToolData,
  normalizeDesvinculacionFilters,
} from "@/lib/talento-humano-herramienta-desvinculacion";

export const dynamic = "force-dynamic";

export default async function HerramientaDesvinculacionRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/talento-humano/herramienta-desvinculacion",
    loader: async () => {
      const { filters, weeks } = await normalizeDesvinculacionFilters({});
      return getDesvinculacionToolData(filters, weeks);
    },
    fallbackMessage: "No se pudo cargar la herramienta de desvinculación.",
  });

  if (!data) return <DashboardRouteError title="Herramienta de Desvinculación" error={error} />;
  return <HerramientaDesvinculacionPage initialData={data} />;
}
