import { listCurrentPostharvestDestinations } from "@/lib/postcosecha-destinos";
import { PostcosechaDestinosPage } from "@/modules/postcosecha/components/postcosecha-destinos-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function PostcosechaDestinosPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/postcosecha/administrar-maestros/destinos",
    loader: () => listCurrentPostharvestDestinations(),
    fallbackMessage: "No se pudo cargar el maestro de destinos.",
    fallbackData: [],
  });

  return <PostcosechaDestinosPage initialData={data ?? []} initialError={error} />;
}
