import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { getDesvinculacionPersonHistory } from "@/lib/talento-humano-herramienta-desvinculacion";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const rawPersonId = request.nextUrl.searchParams.get("personId") ?? "";
  const personId = rawPersonId.trim();

  if (!personId) {
    return NextResponse.json({ message: "personId requerido." }, { status: 400 });
  }

  try {
    const data = await getDesvinculacionPersonHistory(personId);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[herramienta-desvinculacion/history?personId=${personId}] ${errorMessage}`);
    return NextResponse.json(
      { personId, personName: personId, weeks: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
