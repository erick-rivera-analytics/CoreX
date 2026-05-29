import {
  listFumigationWeekProgram,
  listFumigationWeekProgramOptions,
  type FumigationWeekProgramFilters,
} from "@/lib/fumigation-week-program";
import { BodegaFumigationProgramPage } from "@/modules/bodega/components/bodega-fumigation-program-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export default async function BodegaPlanificacionAplicacionesFitosanitariasPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/bodega/planificacion/programaciones",
    loader: async () => {
      const initialOptions = await listFumigationWeekProgramOptions();
      const initialFilters: FumigationWeekProgramFilters = {
        isoWeekId: initialOptions.defaultIsoWeekId,
        kind: "",
        variety: "",
        areaId: "",
      };

      const initialRows = await listFumigationWeekProgram(initialFilters);

      return {
        initialRows,
        initialOptions,
        initialFilters,
      };
    },
    fallbackMessage: "No se pudo cargar la programacion de aplicaciones fitosanitarias para Bodega.",
    fallbackData: {
      initialRows: [],
      initialOptions: {
        isoWeeks: [],
        kinds: ["REGULAR", "DRON", "LANZAS"],
        varieties: [],
        areas: [],
        defaultIsoWeekId: "",
      },
      initialFilters: {
        isoWeekId: "",
        kind: "",
        variety: "",
        areaId: "",
      },
    },
  });

  return (
    <BodegaFumigationProgramPage
      initialRows={data?.initialRows ?? []}
      initialOptions={data?.initialOptions ?? {
        isoWeeks: [],
        kinds: ["REGULAR", "DRON", "LANZAS"],
        varieties: [],
        areas: [],
        defaultIsoWeekId: "",
      }}
      initialFilters={data?.initialFilters ?? {
        isoWeekId: "",
        kind: "",
        variety: "",
        areaId: "",
      }}
      initialError={error}
    />
  );
}
