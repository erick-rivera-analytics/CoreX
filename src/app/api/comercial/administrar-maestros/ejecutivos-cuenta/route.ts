import { type NextRequest, NextResponse } from "next/server";

import { formatZodIssue } from "@/lib/admin-masters-schemas";
import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import {
  createCommercialAccountExecutive,
  listCommercialAccountExecutives,
} from "@/lib/commercial-account-executives";
import { commercialAccountExecutiveInputSchema } from "@/lib/commercial-account-executives-schemas";
import { checkRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

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
    const data = await listCommercialAccountExecutives();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el maestro de ejecutivos de cuenta.");
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const rl = checkRateLimit(`commercial-account-executives:${readRequesterIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return jsonError(
      "Demasiados intentos. Intenta nuevamente en un momento.",
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  try {
    const raw = await request.json().catch(() => null);
    const parsed = commercialAccountExecutiveInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(formatZodIssue(parsed.error.issues), 400);
    }

    const actorId = await readActorId("corex_commercial_account_executives_ui");
    const data = await createCommercialAccountExecutive(parsed.data, actorId);

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

    return handleApiError(error, "No se pudo crear el ejecutivo de cuenta.");
  }
}
