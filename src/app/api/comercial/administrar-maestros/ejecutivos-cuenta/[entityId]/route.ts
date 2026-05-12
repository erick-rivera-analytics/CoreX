import { type NextRequest, NextResponse } from "next/server";

import { formatZodIssue } from "@/lib/admin-masters-schemas";
import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { updateCommercialAccountExecutive } from "@/lib/commercial-account-executives";
import { commercialAccountExecutiveInputSchema } from "@/lib/commercial-account-executives-schemas";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ message, error: message }, { status });
}

async function readActorId(fallbackActorId: string) {
  return (await getSession()) ?? fallbackActorId;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const raw = await request.json().catch(() => null);
    const parsed = commercialAccountExecutiveInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(formatZodIssue(parsed.error.issues), 400);
    }

    const { entityId } = await context.params;
    const actorId = await readActorId("corex_commercial_account_executives_ui");
    const data = await updateCommercialAccountExecutive(decodeURIComponent(entityId), parsed.data, actorId);

    return NextResponse.json(
      { data },
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

    return handleApiError(error, "No se pudo actualizar el ejecutivo de cuenta.");
  }
}
