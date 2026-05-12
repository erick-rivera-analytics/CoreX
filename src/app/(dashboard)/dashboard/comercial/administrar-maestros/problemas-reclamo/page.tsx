import { listCurrentCommercialClaimProblems } from "@/lib/commercial-masters";
import { CommercialClaimProblemsPage } from "@/modules/comercial/components/commercial-claim-problems-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function CommercialClaimProblemsPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/comercial/administrar-maestros/problemas-reclamo",
    loader: listCurrentCommercialClaimProblems,
    fallbackMessage: "No se pudo cargar el arbol de problemas de reclamo.",
    fallbackData: [],
  });

  return <CommercialClaimProblemsPage initialData={data ?? []} initialError={error} />;
}
