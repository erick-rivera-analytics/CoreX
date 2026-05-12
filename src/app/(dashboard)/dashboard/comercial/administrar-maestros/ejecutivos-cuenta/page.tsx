import { listCommercialAccountExecutives } from "@/lib/commercial-account-executives";
import { CommercialAccountExecutivesPage } from "@/modules/comercial/components/commercial-account-executives-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function CommercialAccountExecutivesPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/comercial/administrar-maestros/ejecutivos-cuenta",
    loader: () => listCommercialAccountExecutives(),
    fallbackMessage: "No se pudo cargar el maestro de ejecutivos de cuenta.",
    fallbackData: [],
  });

  return <CommercialAccountExecutivesPage initialData={data ?? []} initialError={error} />;
}
