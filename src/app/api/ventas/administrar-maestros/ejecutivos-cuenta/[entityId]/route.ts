import { type NextRequest } from "next/server";

import { handleQualitySimpleMasterPatch } from "@/lib/quality-master-api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  return handleQualitySimpleMasterPatch(request, entityId, {
    kind: "account-executives",
    fallbackActorId: "corex_sales_masters_ui",
    updateErrorMessage: "No se pudo actualizar el ejecutivo de cuenta.",
  });
}
