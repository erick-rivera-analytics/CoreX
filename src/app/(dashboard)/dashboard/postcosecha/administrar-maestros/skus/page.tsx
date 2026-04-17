import { listCurrentPostharvestSkus } from "@/lib/postcosecha-skus";
import { SkusPage } from "@/modules/postcosecha/components/skus-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function AdministrarSkusPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/postcosecha/administrar-maestros/skus",
    loader: listCurrentPostharvestSkus,
    fallbackMessage: "No se pudo cargar el maestro de SKU de postcosecha.",
    fallbackData: [],
  });

  return <SkusPage initialData={data ?? []} initialError={error} />;
}
