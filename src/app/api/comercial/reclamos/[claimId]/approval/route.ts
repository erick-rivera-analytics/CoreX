import { type NextRequest, NextResponse } from "next/server";

import { formatZodIssue } from "@/lib/admin-masters-schemas";
import { handleApiError } from "@/lib/api-error";
import { requireAuth, requireResourceAccess } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import {
  decideCommercialClaimApproval,
  type CommercialClaimModuleData,
} from "@/lib/comercial-reclamos";
import { commercialClaimApprovalSchema } from "@/lib/comercial-reclamos-schemas";

function jsonError(message: string, status: number) {
  return NextResponse.json({ message, error: message }, { status });
}

async function readActorId(fallbackActorId: string) {
  return (await getSession()) ?? fallbackActorId;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ claimId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const resourceError = await requireResourceAccess("panel:commercial.claims.approval");
  if (resourceError) return resourceError;

  try {
    const { claimId } = await context.params;
    const raw = await request.json().catch(() => null);
    const parsed = commercialClaimApprovalSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(formatZodIssue(parsed.error.issues), 400);
    }

    const actorId = await readActorId("commercial_claim_approval");
    const data = await decideCommercialClaimApproval(
      decodeURIComponent(claimId),
      parsed.data.decision,
      actorId,
      parsed.data.note,
    );

    return NextResponse.json<CommercialClaimModuleData>(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }
    return handleApiError(error, "No se pudo procesar la aprobacion del reclamo.");
  }
}
