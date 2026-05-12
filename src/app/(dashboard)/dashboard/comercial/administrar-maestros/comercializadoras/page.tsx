import { listCurrentCommercialSimpleMasterRecords } from "@/lib/commercial-masters";
import { CommercialCommercializersPage } from "@/modules/comercial/components/commercial-commercializers-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function CommercialCommercializersPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/comercial/administrar-maestros/comercializadoras",
    loader: () => listCurrentCommercialSimpleMasterRecords("commercializers"),
    fallbackMessage: "No se pudo cargar el maestro de comercializadoras.",
    fallbackData: [],
  });

  return <CommercialCommercializersPage initialData={data ?? []} initialError={error} />;
}
