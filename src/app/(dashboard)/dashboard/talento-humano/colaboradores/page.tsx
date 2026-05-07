import { DashboardRouteError, loadProtectedPageData } from "@/modules/core/server-page";
import { TalentoColaboradoresPage } from "@/modules/talento-humano/components/colaboradores-page";

export const dynamic = "force-dynamic";

export default async function TalentoColaboradoresRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/talento-humano/colaboradores",
    loader: async () => true,
    fallbackMessage: "No se pudo cargar el explorador de colaboradores.",
  });

  if (!data) return <DashboardRouteError title="Colaboradores" error={error} />;
  return <TalentoColaboradoresPage />;
}
