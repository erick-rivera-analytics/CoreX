import {
  listCampoFumigationPlanning,
  listCampoFumigationPlanningOptions,
  type CampoFumigationPlanningFilters,
} from "@/lib/campo-fumigation-planning";
import { CampoFumigationPlanningPage } from "@/modules/campo/components/campo-fumigation-planning-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function CampoPlanificacionFumigacionPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/programaciones",
    loader: async () => {
      const initialOptions = await listCampoFumigationPlanningOptions();
      const initialFilters: CampoFumigationPlanningFilters = {
        isoWeekId: initialOptions.defaultIsoWeekId,
        variety: "",
        areaId: "",
      };

      const initialRows = await listCampoFumigationPlanning(initialFilters);

      return {
        initialRows,
        initialOptions,
        initialFilters,
      };
    },
    fallbackMessage: "No se pudo cargar la planificacion operativa de fumigacion.",
    fallbackData: {
      initialRows: [],
      initialOptions: {
        isoWeeks: [],
        varieties: [],
        areas: [],
        defaultIsoWeekId: "",
        kinds: ["REGULAR", "DRON", "LANZAS"],
      },
      initialFilters: {
        isoWeekId: "",
        variety: "",
        areaId: "",
      },
    },
  });

  return (
    <CampoFumigationPlanningPage
      initialRows={data?.initialRows ?? []}
      initialOptions={data?.initialOptions ?? {
        isoWeeks: [],
        varieties: [],
        areas: [],
        defaultIsoWeekId: "",
        kinds: ["REGULAR", "DRON", "LANZAS"],
      }}
      initialFilters={data?.initialFilters ?? {
        isoWeekId: "",
        variety: "",
        areaId: "",
      }}
      initialError={error}
    />
  );
}
