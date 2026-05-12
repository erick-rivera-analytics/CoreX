import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getCommercialClaimAttachmentBinary } from "@/lib/comercial-reclamos";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ claimId: string; attachmentId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { claimId, attachmentId } = await context.params;
    const data = await getCommercialClaimAttachmentBinary(
      decodeURIComponent(claimId),
      decodeURIComponent(attachmentId),
    );

    return new NextResponse(data.buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": data.mimeType,
        "Content-Disposition": `inline; filename="${data.fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message, error: error.message }, { status: 404 });
    }
    return handleApiError(error, "No se pudo cargar la imagen del reclamo.");
  }
}
