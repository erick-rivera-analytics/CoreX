import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth, requireResourceAccess } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { attachCommercialClaimPhoto } from "@/lib/comercial-reclamos";
import { checkRateLimit } from "@/server/security/rate-limit";

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ message, error: message }, { status, headers });
}

function readRequesterIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

async function readActorId(fallbackActorId: string) {
  return (await getSession()) ?? fallbackActorId;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ claimId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const resourceError = await requireResourceAccess("panel:commercial.claims.registration");
  if (resourceError) return resourceError;

  const rl = checkRateLimit(`commercial-claim-photo:${readRequesterIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return jsonError(
      "Demasiados intentos. Intenta nuevamente en un momento.",
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  try {
    const formData = await request.formData();
    const photo = formData.get("photo");
    if (!(photo instanceof File)) {
      return jsonError("Debes adjuntar una foto valida.", 400);
    }

    const { claimId } = await context.params;
    const actorId = await readActorId("commercial_claim_photo_upload");
    const data = await attachCommercialClaimPhoto(decodeURIComponent(claimId), photo, actorId);

    return NextResponse.json(
      { data },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }
    return handleApiError(error, "No se pudo guardar la foto del reclamo.");
  }
}
