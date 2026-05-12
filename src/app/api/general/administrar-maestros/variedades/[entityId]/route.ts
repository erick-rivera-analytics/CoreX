import { type NextRequest } from "next/server";

import { handleGeneralSimpleMasterPatch } from "@/lib/general-master-api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;

  return handleGeneralSimpleMasterPatch(request, entityId, {
    kind: "varieties",
    fallbackActorId: "corex_general_masters_ui",
    updateErrorMessage: "No se pudo actualizar la variedad.",
  });
}
