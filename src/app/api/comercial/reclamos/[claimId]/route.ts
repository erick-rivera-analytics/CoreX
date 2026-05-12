import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getCommercialClaimDetail, type CommercialClaimDetail } from "@/lib/comercial-reclamos";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ claimId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { claimId } = await context.params;
    const data = await getCommercialClaimDetail(decodeURIComponent(claimId));
    return NextResponse.json<CommercialClaimDetail>(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message, error: error.message }, { status: 404 });
    }
    return handleApiError(error, "No se pudo cargar el detalle del reclamo.");
  }
}
