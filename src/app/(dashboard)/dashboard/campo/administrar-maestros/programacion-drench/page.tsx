import {
  getCurrentDrenchProgramSummary,
  listCurrentDrenchAssignableProducts,
  listCurrentDrenchProgramRules,
} from "@/lib/campo-drench-program";
import { CampoDrenchProgramPage } from "@/modules/campo/components/campo-drench-program-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export default async function CampoDrenchProgramMasterPage() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/campo/administrar-maestros/programacion-drench",
    loader: async () => {
      const [initialRules, initialAssignableProducts, initialSummary] = await Promise.all([
        listCurrentDrenchProgramRules(),
        listCurrentDrenchAssignableProducts(),
        getCurrentDrenchProgramSummary(),
      ]);

      return {
        initialRules,
        initialAssignableProducts,
        initialSummary,
      };
    },
    fallbackMessage: "No se pudo cargar la programacion de drench.",
    fallbackData: {
      initialRules: [],
      initialAssignableProducts: [],
      initialSummary: { rules: 0, lines: 0 },
    },
  });

  return (
    <CampoDrenchProgramPage
      initialRules={data?.initialRules ?? []}
      initialAssignableProducts={data?.initialAssignableProducts ?? []}
      initialSummary={data?.initialSummary ?? { rules: 0, lines: 0 }}
      initialError={error}
    />
  );
}
