import { NextRequest, NextResponse } from "next/server";

import { requireAuth, getCurrentUserAccess } from "@/lib/api-auth";
import { apiJsonError, handleApiError } from "@/lib/api-error";
import { getRequestId } from "@/lib/request-id";
import {
  createGoalTarget,
  listActiveGoalTargets,
  listGoalTargetHistory,
  setGoalTargetValidity,
  updateGoalTarget,
} from "@/lib/admin-masters-goals";
import { listActiveMetrics } from "@/lib/admin-masters-metrics";
import { loadAdminCatalogs } from "@/lib/admin-masters-catalogs";

export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const historyOf = url.searchParams.get("historyOf");
    if (historyOf) {
      const history = await listGoalTargetHistory(historyOf);
      return NextResponse.json({ history }, { headers: { "Cache-Control": "no-store" } });
    }

    const [targets, metrics, catalogs] = await Promise.all([
      listActiveGoalTargets(),
      listActiveMetrics(),
      loadAdminCatalogs(),
    ]);
    const operators = catalogs.items.filter((i) => i.catalogCode === "comparison_operators");
    const goalTypes = catalogs.items.filter((i) => i.catalogCode === "goal_types");

    return NextResponse.json(
      { targets, metrics, domains: catalogs.domains, operators, goalTypes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleApiError(error, "No se pudo cargar metas y objetivos.", requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;
  const access = await getCurrentUserAccess();
  if (!access) return apiJsonError("No autenticado.", 401, requestId);

  try {
    const body = await request.json();
    if (!body.targetCode || !body.validFromDate) {
      return apiJsonError("targetCode y validFromDate son obligatorios.", 400, requestId);
    }
    if (!ISO_DATE_RE.test(String(body.validFromDate))) {
      return apiJsonError("validFromDate debe ser YYYY-MM-DD.", 400, requestId);
    }

    await createGoalTarget({
      targetCode: String(body.targetCode),
      targetName: String(body.targetName ?? body.targetCode),
      targetDescription: body.targetDescription ?? null,
      metricCode: body.metricCode ?? null,
      operatorCode: body.operatorCode ?? null,
      valueMin: asNumberOrNull(body.valueMin),
      valueMax: asNumberOrNull(body.valueMax),
      valueText: body.valueText ?? null,
      notesText: body.notesText ?? null,
      domainCodes: asStringArray(body.domainCodes),
      typeItemCodes: asStringArray(body.typeItemCodes),
      validFromDate: String(body.validFromDate),
      actorId: access.username,
      changeReason: body.changeReason ? String(body.changeReason) : "manual_create",
      targetScopeJsonb: body.targetScopeJsonb ?? null,
    });

    const targets = await listActiveGoalTargets();
    return NextResponse.json({ targets }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "No se pudo crear la meta.", requestId);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;
  const access = await getCurrentUserAccess();
  if (!access) return apiJsonError("No autenticado.", 401, requestId);

  try {
    const body = await request.json();
    const action = String(body.action ?? "update");

    if (action === "set-validity") {
      if (!body.targetCode || typeof body.isValid !== "boolean") {
        return apiJsonError("targetCode e isValid son obligatorios.", 400, requestId);
      }
      await setGoalTargetValidity(
        String(body.targetCode),
        Boolean(body.isValid),
        access.username,
        body.changeReason ? String(body.changeReason) : "manual_update",
      );
    } else if (action === "update") {
      if (!body.targetCode || !body.validFromDate) {
        return apiJsonError("targetCode y validFromDate son obligatorios.", 400, requestId);
      }
      if (!ISO_DATE_RE.test(String(body.validFromDate))) {
        return apiJsonError("validFromDate debe ser YYYY-MM-DD.", 400, requestId);
      }
      await updateGoalTarget({
        targetCode: String(body.targetCode),
        targetName: String(body.targetName ?? body.targetCode),
        targetDescription: body.targetDescription ?? null,
        metricCode: body.metricCode ?? null,
        operatorCode: body.operatorCode ?? null,
        valueMin: asNumberOrNull(body.valueMin),
        valueMax: asNumberOrNull(body.valueMax),
        valueText: body.valueText ?? null,
        notesText: body.notesText ?? null,
        domainCodes: asStringArray(body.domainCodes),
        typeItemCodes: asStringArray(body.typeItemCodes),
        validFromDate: String(body.validFromDate),
        actorId: access.username,
        changeReason: body.changeReason ? String(body.changeReason) : "manual_update",
        targetScopeJsonb: body.targetScopeJsonb ?? null,
      });
    } else {
      return apiJsonError("action debe ser 'update' o 'set-validity'.", 400, requestId);
    }

    const targets = await listActiveGoalTargets();
    return NextResponse.json({ targets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar la meta.", requestId);
  }
}
