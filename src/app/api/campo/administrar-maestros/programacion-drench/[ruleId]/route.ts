import { type NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { getSession } from "@/lib/auth";
import type { DrenchProgramRuleInput, DrenchProgramRulePayload } from "@/lib/campo-drench-program-types";
import { updateDrenchProgramRule } from "@/lib/campo-drench-program";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ message, error: message }, { status });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ ruleId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { ruleId } = await context.params;
    const payload = (await request.json()) as DrenchProgramRuleInput;
    const actorId = (await getSession()) ?? "corex_campo_drench_ui";
    const data = await updateDrenchProgramRule(decodeURIComponent(ruleId), payload, actorId);

    return NextResponse.json<DrenchProgramRulePayload>(
      { data: data! },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }

    return handleApiError(error, "No se pudo actualizar la regla de drench.");
  }
}
