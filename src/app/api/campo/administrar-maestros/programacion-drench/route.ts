import { type NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/server/security/rate-limit";
import type { DrenchProgramRuleInput, DrenchProgramRulePayload } from "@/lib/campo-drench-program-types";
import {
  createDrenchProgramRule,
  listCurrentDrenchAssignableProducts,
  listCurrentDrenchProgramRules,
} from "@/lib/campo-drench-program";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ message, error: message }, { status, headers });
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const [rules, assignableProducts] = await Promise.all([
      listCurrentDrenchProgramRules(),
      listCurrentDrenchAssignableProducts(),
    ]);

    return NextResponse.json(
      {
        rules,
        assignableProducts,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return handleApiError(error, "No se pudo cargar la programación de drench.");
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
  const rl = checkRateLimit(`campo-drench-program:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return jsonError(
      "Demasiados intentos. Intenta nuevamente en un momento.",
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  try {
    const payload = (await request.json()) as DrenchProgramRuleInput;
    const actorId = (await getSession()) ?? "corex_campo_drench_ui";
    const data = await createDrenchProgramRule(payload, actorId);

    return NextResponse.json<DrenchProgramRulePayload>(
      { data: data! },
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

    return handleApiError(error, "No se pudo crear la regla de drench.");
  }
}
