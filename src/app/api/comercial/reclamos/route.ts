import { type NextRequest, NextResponse } from "next/server";

import { formatZodIssue } from "@/lib/admin-masters-schemas";
import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import {
  createCommercialClaim,
  getCommercialClaimModuleData,
  type CommercialClaimModuleData,
} from "@/lib/comercial-reclamos";
import { commercialClaimCreateSchema } from "@/lib/comercial-reclamos-schemas";
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

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const data = await getCommercialClaimModuleData();
    return NextResponse.json<CommercialClaimModuleData>(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el modulo de reclamos.");
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const rl = checkRateLimit(`commercial-claims:${readRequesterIp(request)}`, 30, 60_000);
  if (!rl.allowed) {
    return jsonError(
      "Demasiados intentos. Intenta nuevamente en un momento.",
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  try {
    const raw = await request.json().catch(() => null);
    const parsed = commercialClaimCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(formatZodIssue(parsed.error.issues), 400);
    }

    const actorId = await readActorId("commercial_claim_create");
    const data = await createCommercialClaim({
      ...parsed.data,
      processDestinationId: parsed.data.processDestinationId ?? null,
      processNotApplicable: parsed.data.processNotApplicable ?? false,
      problemFamilyId: parsed.data.problemFamilyId ?? null,
      referenceOrderNumber: parsed.data.referenceOrderNumber ?? null,
      referenceInvoiceNumber: parsed.data.referenceInvoiceNumber ?? null,
      eventDate: parsed.data.eventDate ?? null,
      subject: parsed.data.subject ?? "",
      description: parsed.data.description ?? null,
    }, actorId);

    return NextResponse.json<CommercialClaimModuleData>(data, {
      status: 201,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }
    return handleApiError(error, "No se pudo registrar el reclamo.");
  }
}
