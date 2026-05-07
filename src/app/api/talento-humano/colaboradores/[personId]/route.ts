import { NextRequest, NextResponse } from "next/server";

import { requireAuth, getCurrentUserAccess } from "@/lib/api-auth";
import { canAccessResource } from "@/lib/access-control";
import { handleApiError } from "@/lib/api-error";
import { getCollaboratorDetail } from "@/lib/talento-humano-colaboradores";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ personId: string }> };

function allowed(resource: string, access: NonNullable<Awaited<ReturnType<typeof getCurrentUserAccess>>>) {
  return canAccessResource(resource, access.allowedResources, access.isSuperadmin);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const access = await getCurrentUserAccess();
    if (!access) {
      return NextResponse.json({ message: "Missing authentication token" }, { status: 401 });
    }

    const { personId } = await context.params;
    if (!personId) {
      return NextResponse.json({ message: "personId requerido." }, { status: 400 });
    }

    const canViewBasic = allowed("panel:tthh.collaborators.basic", access);

    const data = await getCollaboratorDetail(decodeURIComponent(personId), {
      performance: canViewBasic || allowed("panel:tthh.collaborators.performance", access),
      absenteeism: canViewBasic || allowed("panel:tthh.collaborators.absenteeism", access),
      exits: allowed("panel:tthh.collaborators.exits", access),
      followups: allowed("panel:tthh.collaborators.followups", access),
    });

    if (!data) {
      return NextResponse.json({ message: "Colaborador no encontrado." }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el colaborador.");
  }
}
