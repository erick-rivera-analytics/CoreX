import { listCurrentGeneralSimpleMasterRecords } from "@/lib/general-masters";
import { GeneralVarietiesPage } from "@/modules/general/components/general-varieties-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function GeneralVarietiesPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/general/administrar-maestros/variedades",
    loader: () => listCurrentGeneralSimpleMasterRecords("varieties"),
    fallbackMessage: "No se pudo cargar el maestro de variedades.",
    fallbackData: [],
  });

  return <GeneralVarietiesPage initialData={data ?? []} initialError={error} />;
}
