import { requirePageAccess } from "@/lib/api-auth";
import { DashboardRouteError } from "@/modules/core/server-page";
import { loadMyWorkPageData, MyWorkPage, type MyWorkInitialData } from "@/modules/my-work";
import { mapPersonalWorkPageData } from "@/modules/my-work/server/mappers";

export const dynamic = "force-dynamic";

export default async function MiTrabajoPageRoute() {
  const access = await requirePageAccess("/dashboard/mi-trabajo");
  let initialData: MyWorkInitialData | null = null;
  let errorMessage: string | null = null;

  try {
    const data = await loadMyWorkPageData(access);
    initialData = mapPersonalWorkPageData(data, access.username);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "No se pudo cargar el espacio de trabajo personal.";
  }

  if (!initialData) {
    return <DashboardRouteError title="Mi trabajo" error={errorMessage} />;
  }

  return <MyWorkPage initialData={initialData} />;
}
