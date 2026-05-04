import { listCurrentBodegaCategories } from "@/lib/bodega-masters";
import { BodegaCategoriasPage } from "@/modules/bodega/components/bodega-categorias-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function BodegaCategoriasRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/bodega/administrar-maestros/categorias",
    loader: listCurrentBodegaCategories,
    fallbackMessage: "No se pudo cargar el catalogo de Bodega.",
    fallbackData: [],
  });

  return <BodegaCategoriasPage initialData={data ?? []} initialError={error} />;
}
