import { NextRequest, NextResponse } from "next/server";

import { createGoalTargetsBulk, listActiveGoalTargets } from "@/lib/admin-masters-goals";
import { adminGoalTargetBulkUpsertSchema } from "@/lib/admin-masters-schemas";
import { enforceAdminMaestrosRateLimit, parseAndValidate } from "@/lib/admin-mutation-guard";
import { requireAuth, getCurrentUserAccess } from "@/lib/api-auth";
import { apiJsonError, handleApiError } from "@/lib/api-error";
import { getRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;
  const access = await getCurrentUserAccess();
  if (!access) return apiJsonError("No autenticado.", 401, requestId);

  const rateLimitError = enforceAdminMaestrosRateLimit(
    request,
    "metas-bulk",
    requestId,
    access.username,
  );
  if (rateLimitError) return rateLimitError;

  const { data, errorResponse } = await parseAndValidate(
    request,
    adminGoalTargetBulkUpsertSchema,
    requestId,
  );
  if (errorResponse) return errorResponse;

  try {
    await createGoalTargetsBulk(
      data!.rows.map((row) => ({
        targetCode: row.targetCode,
        targetName: row.targetName ?? row.targetCode,
        targetDescription: row.targetDescription ?? null,
        metricCode: row.metricCode ?? null,
        operatorCode: row.operatorCode ?? null,
        valueMin: row.valueMin ?? null,
        valueMax: row.valueMax ?? null,
        valueText: row.valueText ?? null,
        notesText: row.notesText ?? null,
        domainCodes: row.domainCodes ?? [],
        typeItemCodes: row.typeItemCodes ?? [],
        validFromDate: row.validFromDate,
        actorId: access.username,
        changeReason: row.changeReason ?? "bulk_create",
        targetScopeJsonb: row.targetScopeJsonb ?? null,
      })),
    );

    const targets = await listActiveGoalTargets();
    return NextResponse.json({ targets }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar metas en bloque.", requestId);
  }
}
