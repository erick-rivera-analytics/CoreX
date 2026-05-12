import { listCurrentCommercialSimpleMasterRecords } from "@/lib/commercial-masters";
import { CommercialCustomersPage } from "@/modules/comercial/components/commercial-customers-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function CommercialCustomersPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/comercial/administrar-maestros/clientes",
    loader: () => listCurrentCommercialSimpleMasterRecords("customers"),
    fallbackMessage: "No se pudo cargar el maestro de clientes.",
    fallbackData: [],
  });

  return <CommercialCustomersPage initialData={data ?? []} initialError={error} />;
}
