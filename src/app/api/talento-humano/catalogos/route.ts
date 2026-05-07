import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, getCurrentUserAccess } from "@/lib/api-auth";
import { apiJsonError, handleApiError } from "@/lib/api-error";
import { getRequestId } from "@/lib/request-id";
import { checkRequestRateLimit, getEnvNumber } from "@/server/security/rate-limit";
import {
  listTthhCatalogs,
  setTthhCatalogValidity,
  upsertTthhCatalogDomain,
  upsertTthhCatalogGroup,
  upsertTthhCatalogItem,
} from "@/lib/admin-masters";

export const dynamic = "force-dynamic";

// ── Schemas zod canon ─────────────────────────────────────────────────────────
// Validamos el body en el edge para que errores de validación devuelvan 400 con
// mensajes de zod uniformes en lugar de propagarse a la lib y caer en 500.

const TrimmedNonEmpty = z.string().trim().min(1);
const ChangeReason = z.string().trim().max(200).optional().nullable().default(null);

const tthhDomainUpsertSchema = z.object({
  kind: z.literal("domain"),
  action: z.literal("upsert").default("upsert"),
  domainCode: TrimmedNonEmpty.max(64),
  domainName: TrimmedNonEmpty.max(120),
  domainDescription: z.string().trim().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isValid: z.boolean().optional().default(true),
  changeReason: ChangeReason,
});

const tthhGroupUpsertSchema = z.object({
  kind: z.literal("group"),
  action: z.literal("upsert").default("upsert"),
  catalogCode: TrimmedNonEmpty.max(64),
  catalogName: TrimmedNonEmpty.max(120),
  catalogDescription: z.string().trim().optional().nullable(),
  domainCode: TrimmedNonEmpty.max(64),
  isSystemCatalog: z.boolean().optional().default(false),
  changeReason: ChangeReason,
});

const tthhItemUpsertSchema = z.object({
  kind: z.literal("item"),
  action: z.literal("upsert").default("upsert"),
  catalogCode: TrimmedNonEmpty.max(64),
  itemCode: TrimmedNonEmpty.max(64),
  itemLabelEs: TrimmedNonEmpty.max(160),
  itemLabelEn: z.string().trim().optional().nullable(),
  itemDescription: z.string().trim().optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  changeReason: ChangeReason,
});

const tthhValiditySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("domain"),
    action: z.literal("set-validity"),
    domainCode: TrimmedNonEmpty.max(64),
    isValid: z.boolean(),
    changeReason: ChangeReason,
  }),
  z.object({
    kind: z.literal("group"),
    action: z.literal("set-validity"),
    catalogCode: TrimmedNonEmpty.max(64),
    isValid: z.boolean(),
    changeReason: ChangeReason,
  }),
  z.object({
    kind: z.literal("item"),
    action: z.literal("set-validity"),
    catalogCode: TrimmedNonEmpty.max(64),
    itemCode: TrimmedNonEmpty.max(64),
    isValid: z.boolean(),
    changeReason: ChangeReason,
  }),
]);

const tthhCatalogMutationSchema = z.union([
  tthhDomainUpsertSchema,
  tthhGroupUpsertSchema,
  tthhItemUpsertSchema,
  tthhValiditySchema,
]);

function formatZodIssue(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "Datos inválidos.";
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${path}${first.message}`;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const data = await listTthhCatalogs();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar catalogos TTHH.", requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;
  const access = await getCurrentUserAccess();
  if (!access) return apiJsonError("No autenticado.", 401, requestId);

  const rl = checkRequestRateLimit({
    request,
    scope: "tthh-catalogs:write",
    suffix: access.username,
    limit: getEnvNumber("TTHH_CATALOGS_WRITE_RATE_LIMIT", 20),
    windowMs: getEnvNumber("TTHH_CATALOGS_WRITE_RATE_LIMIT_WINDOW_MS", 60_000),
  });
  if (!rl.allowed) {
    return apiJsonError("Demasiados intentos. Intente más tarde.", 429, requestId, {
      "Retry-After": String(rl.retryAfterSeconds),
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiJsonError("Cuerpo JSON inválido.", 400, requestId);
  }

  const parsed = tthhCatalogMutationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiJsonError(formatZodIssue(parsed.error), 400, requestId);
  }

  try {
    const body = parsed.data;

    if (body.kind === "domain" && body.action === "upsert") {
      await upsertTthhCatalogDomain({ ...body, actorId: access.username });
    } else if (body.kind === "group" && body.action === "upsert") {
      await upsertTthhCatalogGroup({ ...body, actorId: access.username });
    } else if (body.kind === "item" && body.action === "upsert") {
      await upsertTthhCatalogItem({ ...body, actorId: access.username });
    } else if (body.action === "set-validity") {
      // Normaliza el shape requerido por la lib (catalogCode siempre presente,
      // los otros opcionales según el kind del discriminated union).
      await setTthhCatalogValidity(body.kind, {
        catalogCode: "catalogCode" in body ? body.catalogCode : "",
        itemCode: "itemCode" in body ? body.itemCode : undefined,
        domainCode: "domainCode" in body ? body.domainCode : undefined,
        isValid: body.isValid,
        actorId: access.username,
      });
    }

    const data = await listTthhCatalogs();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "No se pudo guardar el catalogo.", requestId);
  }
}
