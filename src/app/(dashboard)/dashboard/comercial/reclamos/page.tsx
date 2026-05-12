import { getCommercialClaimModuleData } from "@/lib/comercial-reclamos";
import { ComercialReclamosPage } from "@/modules/comercial/components/reclamos-page";
import { loadProtectedPageData } from "@/modules/core/server-page";

export const dynamic = "force-dynamic";

export default async function ComercialReclamosPageRoute() {
  const { data, error } = await loadProtectedPageData({
    resourceKey: "/dashboard/comercial/reclamos",
    loader: getCommercialClaimModuleData,
    fallbackMessage: "No se pudo cargar el modulo de reclamos.",
    fallbackData: {
      readiness: {
        customers: 0,
        commercializers: 0,
        accountExecutives: 0,
        farms: 0,
        varieties: 0,
        destinations: 0,
        claimProblemFamilies: 0,
        claimProblems: 0,
      },
      options: {
        customers: [],
        commercializers: [],
        accountExecutives: [],
        farms: [],
        varieties: [],
        destinations: [],
        problemFamilies: [],
        problems: [],
      },
      summary: {
        totalClaims: 0,
        pendingApprovals: 0,
        pendingApplications: 0,
        alertsOnly: 0,
      },
      statuses: [],
      registrationFeed: [],
      approvalQueue: [],
      applicationQueue: [],
      notes: [],
    },
  });

  return <ComercialReclamosPage initialData={data!} initialError={error} />;
}
