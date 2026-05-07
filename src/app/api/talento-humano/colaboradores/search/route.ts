import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { searchCollaborators } from "@/lib/talento-humano-colaboradores";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const sp = request.nextUrl.searchParams;
    const q = sp.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchCollaborators({
      q,
      area: sp.get("area")?.trim() || "all",
      status: sp.get("status") === "all" ? "all" : "active",
    });

    return NextResponse.json({ results }, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo buscar colaboradores.");
  }
}
