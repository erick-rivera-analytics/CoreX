import { listCurrentGeneralSimpleMasterRecords } from "@/lib/general-masters";
import { GeneralFarmsPage } from "@/modules/general/components/general-farms-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function GeneralFarmsPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/general/administrar-maestros/fincas",
    loader: () => listCurrentGeneralSimpleMasterRecords("farms"),
    fallbackMessage: "No se pudo cargar el maestro de fincas.",
    fallbackData: [],
  });

  return <GeneralFarmsPage initialData={data ?? []} initialError={error} />;
}
