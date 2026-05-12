import { type NextRequest } from "next/server";

import { handleCommercialSimpleMasterPatch } from "@/lib/commercial-master-api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  return handleCommercialSimpleMasterPatch(request, entityId, {
    kind: "customers",
    fallbackActorId: "corex_commercial_masters_ui",
    updateErrorMessage: "No se pudo actualizar el cliente.",
  });
}
