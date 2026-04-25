import { listCurrentCampoDrenchProducts } from "@/lib/campo-drench-products";
import { CampoDrenchProductsPage } from "@/modules/campo/components/drench-products-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function CampoAdministrarProductosDrenchPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/campo/administrar-maestros/productos-drench",
    loader: () => listCurrentCampoDrenchProducts(),
    fallbackMessage: "No se pudo cargar el maestro de productos Drench.",
    fallbackData: [],
  });

  return <CampoDrenchProductsPage initialData={data ?? []} initialError={error} />;
}
