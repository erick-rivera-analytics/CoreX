import { requirePageAccess } from "@/lib/api-auth";
import { DashboardRouteError } from "@/modules/core/server-page";
import { loadMyAccountPageData, MyAccountPage, type MyAccountInitialData } from "@/modules/my-account";
import { mapAccountPageData } from "@/modules/my-account/server/mappers";

export const dynamic = "force-dynamic";

export default async function MiCuentaPageRoute() {
  const access = await requirePageAccess("/dashboard/mi-cuenta");
  let initialData: MyAccountInitialData | null = null;
  let errorMessage: string | null = null;

  try {
    const data = await loadMyAccountPageData(access);
    initialData = mapAccountPageData(data, access.username);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "No se pudo cargar la cuenta personal.";
  }

  if (!initialData) {
    return <DashboardRouteError title="Mi cuenta" error={errorMessage} />;
  }

  return <MyAccountPage initialData={initialData} />;
}
