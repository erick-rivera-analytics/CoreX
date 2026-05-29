import { type NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  listFumigationWeekProgram,
  listFumigationWeekProgramOptions,
  type FumigationWeekProgramFilters,
} from "@/lib/fumigation-week-program";

export const dynamic = "force-dynamic";

function readFilters(searchParams: URLSearchParams): FumigationWeekProgramFilters {
  return {
    isoWeekId: searchParams.get("isoWeekId")?.trim() ?? "",
    kind: (searchParams.get("kind")?.trim().toUpperCase() ?? "") as FumigationWeekProgramFilters["kind"],
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
      listFumigationWeekProgram(appliedFilters),
      listFumigationWeekProgramOptions(),
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
    return handleApiError(error, "No se pudo cargar la programacion de aplicaciones fitosanitarias.");
  }
}
