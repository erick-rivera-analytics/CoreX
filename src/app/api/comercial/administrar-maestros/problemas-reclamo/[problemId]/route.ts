import { type NextRequest } from "next/server";

import { handleCommercialClaimProblemPatch } from "@/lib/commercial-master-api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ problemId: string }> },
) {
  const { problemId } = await context.params;

  return handleCommercialClaimProblemPatch(request, problemId, {
    fallbackActorId: "corex_commercial_masters_ui",
    updateErrorMessage: "No se pudo actualizar el problema de reclamo.",
  });
}
