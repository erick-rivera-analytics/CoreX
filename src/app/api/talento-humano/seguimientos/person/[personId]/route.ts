import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { getPersonDetail } from "@/lib/talento-humano-seguimientos-person";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { personId: rawPersonId } = await params;
    const personId = rawPersonId?.trim();
    if (!personId) {
      return NextResponse.json({ message: "personId requerido." }, { status: 400 });
    }

    const asOfDate = request.nextUrl.searchParams.get("asOfDate")?.trim()
      || new Date().toISOString().slice(0, 10);

    const detail = await getPersonDetail(personId, asOfDate);

    if (!detail) {
      return NextResponse.json({ message: "Persona no encontrada." }, { status: 404 });
    }

    return NextResponse.json(detail, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el perfil de la persona.");
  }
}
