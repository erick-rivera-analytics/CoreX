import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUserAccess, requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  listCampoFumigationPlanning,
  listCampoFumigationPlanningOptions,
  saveCampoFumigationPlanningChanges,
  type CampoFumigationPlanningFilters,
  type FumigationPlanKind,
} from "@/lib/campo-fumigation-planning";

export const dynamic = "force-dynamic";

function readFilters(searchParams: URLSearchParams): CampoFumigationPlanningFilters {
  return {
    isoWeekId: searchParams.get("isoWeekId")?.trim() ?? "",
    variety: searchParams.get("variety")?.trim().toUpperCase() ?? "",
    areaId: searchParams.get("areaId")?.trim().toUpperCase() ?? "",
  };
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const appliedFilters = readFilters(request.nextUrl.searchParams);
    const [rows, options] = await Promise.all([
      listCampoFumigationPlanning(appliedFilters),
      listCampoFumigationPlanningOptions(),
    ]);

    return NextResponse.json(
      {
        rows,
        options,
        appliedFilters: {
          ...appliedFilters,
          isoWeekId: appliedFilters.isoWeekId || options.defaultIsoWeekId,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return handleApiError(error, "No se pudo cargar la planificacion operativa de fumigacion.");
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const access = await getCurrentUserAccess();
    if (!access) {
      throw new Error("No se pudo resolver el usuario autenticado.");
    }
    const body = await request.json() as {
      isoWeekId?: string;
      changes?: Array<{
        cycleKey?: string;
        blockId?: string;
        parentBlock?: string | null;
        areaId?: string | null;
        variety?: string | null;
        phenologicalWeek?: number | null;
        selectedKind?: FumigationPlanKind;
      }>;
    };

    const result = await saveCampoFumigationPlanningChanges({
      isoWeekId: String(body.isoWeekId ?? "").trim(),
      actorId: access.username,
      changes: Array.isArray(body.changes) ? body.changes.map((change) => ({
        cycleKey: String(change.cycleKey ?? "").trim(),
        blockId: String(change.blockId ?? "").trim(),
        parentBlock: change.parentBlock ?? null,
        areaId: change.areaId ?? null,
        variety: change.variety ?? null,
        phenologicalWeek: typeof change.phenologicalWeek === "number" ? change.phenologicalWeek : null,
        selectedKind: change.selectedKind ?? "REGULAR",
      })) : [],
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo guardar la planificacion operativa de fumigacion.");
  }
}
