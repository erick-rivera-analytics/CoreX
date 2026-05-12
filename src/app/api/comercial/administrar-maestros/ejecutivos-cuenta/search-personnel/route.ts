import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { searchCommercialPersonnelCandidates } from "@/lib/commercial-account-executives";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const queryText = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (queryText.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchCommercialPersonnelCandidates(queryText);
    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  } catch (error) {
    return handleApiError(error, "No se pudo buscar personal agricola.");
  }
}
