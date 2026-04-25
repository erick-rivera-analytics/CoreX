import { type NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { getSession } from "@/lib/auth";
import type {
  CampoDrenchProductInput,
  CampoDrenchProductPayload,
} from "@/lib/campo-drench-product-types";
import { updateCampoDrenchProduct } from "@/lib/campo-drench-products";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ message, error: message }, { status });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { productId } = await context.params;
    const payload = (await request.json()) as CampoDrenchProductInput;
    const actorId = (await getSession()) ?? "corex_campo_ui";
    const data = await updateCampoDrenchProduct(decodeURIComponent(productId), payload, actorId);

    return NextResponse.json<CampoDrenchProductPayload>(
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

    return handleApiError(error, "No se pudo actualizar el producto Drench.");
  }
}
