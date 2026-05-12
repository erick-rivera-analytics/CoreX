import { type NextRequest } from "next/server";

import { handlePostharvestDestinationPatch } from "@/lib/postcosecha-destination-api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  return handlePostharvestDestinationPatch(request, entityId, {
    fallbackActorId: "corex_postharvest_masters_ui",
    updateErrorMessage: "No se pudo actualizar el destino.",
  });
}
