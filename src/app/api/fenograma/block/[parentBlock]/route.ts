import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getCycleProfilesByBlock } from "@/lib/fenograma-core";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ parentBlock: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { parentBlock } = await context.params;
    const url = new URL(request.url);
    const cycleKey = url.searchParams.get("cycleKey");
    const data = await getCycleProfilesByBlock(decodeURIComponent(parentBlock), {
      cycleKey: cycleKey ? decodeURIComponent(cycleKey) : null,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el cycle profile del bloque.");
  }
}

