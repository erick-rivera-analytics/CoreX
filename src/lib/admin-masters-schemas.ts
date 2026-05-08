import { z } from "zod";

// ── Common helpers ───────────────────────────────────────────────────────────

const TrimmedNonEmpty = z.string().trim().min(1);
const TrimmedOptional = z.string().trim().optional().nullable();
const ChangeReason = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .default(null);

// ── Catalogos ────────────────────────────────────────────────────────────────

export const adminCatalogGroupUpsertSchema = z.object({
  kind: z.literal("group"),
  catalogCode: TrimmedNonEmpty.max(64),
  catalogName: TrimmedNonEmpty.max(120),
  catalogDescription: TrimmedOptional,
  domainCode: TrimmedNonEmpty.max(64),
  isSystemCatalog: z.boolean().optional().default(false),
  changeReason: ChangeReason,
});

export const adminCatalogItemUpsertSchema = z.object({
  kind: z.literal("item"),
  catalogCode: TrimmedNonEmpty.max(64),
  itemCode: TrimmedNonEmpty.max(64),
  itemLabelEs: TrimmedNonEmpty.max(160),
  itemLabelEn: TrimmedOptional,
  itemDescription: TrimmedOptional,
  displayOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  changeReason: ChangeReason,
});

export const adminCatalogUpsertSchema = z.discriminatedUnion("kind", [
  adminCatalogGroupUpsertSchema,
  adminCatalogItemUpsertSchema,
]);

export const adminCatalogValidityPatchSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("group"),
    catalogCode: TrimmedNonEmpty.max(64),
    isValid: z.boolean(),
    changeReason: ChangeReason,
  }),
  z.object({
    kind: z.literal("item"),
    catalogCode: TrimmedNonEmpty.max(64),
    itemCode: TrimmedNonEmpty.max(64),
    isValid: z.boolean(),
    changeReason: ChangeReason,
  }),
]);

// ── Dominios ─────────────────────────────────────────────────────────────────

export const adminDomainUpsertSchema = z.object({
  domainCode: TrimmedNonEmpty.max(64),
  domainName: TrimmedNonEmpty.max(120),
  domainDescription: TrimmedOptional,
  displayOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isValid: z.boolean().optional().default(true),
  changeReason: ChangeReason,
});

export const adminDomainValidityPatchSchema = z.object({
  domainCode: TrimmedNonEmpty.max(64),
  isValid: z.boolean(),
  changeReason: ChangeReason,
});

// ── Unidades ─────────────────────────────────────────────────────────────────

export const adminUnitUpsertSchema = z.object({
  unitCode: TrimmedNonEmpty.max(32),
  unitName: TrimmedNonEmpty.max(120),
  unitSymbol: TrimmedOptional,
  unitCategoryCode: TrimmedOptional,
  notesText: TrimmedOptional,
  changeReason: ChangeReason,
});

const adminUnitUpdatePatchSchema = adminUnitUpsertSchema.extend({
  action: z.literal("update"),
});

const adminUnitValidityPatchSchema = z.object({
  action: z.literal("set-validity"),
  unitCode: TrimmedNonEmpty.max(32),
  isValid: z.boolean(),
  changeReason: ChangeReason,
});

export const adminUnitPatchSchema = z.discriminatedUnion("action", [
  adminUnitUpdatePatchSchema,
  adminUnitValidityPatchSchema,
]);

// ── Métricas ─────────────────────────────────────────────────────────────────

export const adminMetricUpsertSchema = z.object({
  metricCode: TrimmedNonEmpty.max(64),
  metricName: TrimmedNonEmpty.max(160),
  metricDescription: TrimmedOptional,
  dataTypeCode: TrimmedNonEmpty.max(64),
  directionCode: TrimmedNonEmpty.max(64),
  unitCode: TrimmedOptional,
  notesText: TrimmedOptional,
  changeReason: ChangeReason,
});

const adminMetricUpdatePatchSchema = adminMetricUpsertSchema.extend({
  action: z.literal("update"),
});

const adminMetricValidityPatchSchema = z.object({
  action: z.literal("set-validity"),
  metricCode: TrimmedNonEmpty.max(64),
  isValid: z.boolean(),
  changeReason: ChangeReason,
});

export const adminMetricPatchSchema = z.discriminatedUnion("action", [
  adminMetricUpdatePatchSchema,
  adminMetricValidityPatchSchema,
]);

// ── Metas / Targets ──────────────────────────────────────────────────────────

const IsoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD");

const StringArray = z.array(z.string().trim().min(1)).default([]);

export const adminGoalTargetUpsertSchema = z.object({
  targetCode: TrimmedNonEmpty.max(96),
  targetName: TrimmedOptional,
  targetDescription: TrimmedOptional,
  metricCode: TrimmedOptional,
  operatorCode: TrimmedOptional,
  valueMin: z.coerce.number().finite().nullable().optional(),
  valueMax: z.coerce.number().finite().nullable().optional(),
  valueText: TrimmedOptional,
  notesText: TrimmedOptional,
  domainCodes: StringArray.optional(),
  typeItemCodes: StringArray.optional(),
  validFromDate: IsoDate,
  targetScopeJsonb: z.record(z.string(), z.unknown()).nullable().optional(),
  changeReason: ChangeReason,
});

export const adminGoalTargetBulkUpsertSchema = z.object({
  rows: z.array(adminGoalTargetUpsertSchema).min(1).max(500),
});

const adminGoalTargetUpdatePatchSchema = adminGoalTargetUpsertSchema.extend({
  action: z.literal("update"),
});

const adminGoalTargetValidityPatchSchema = z.object({
  action: z.literal("set-validity"),
  targetCode: TrimmedNonEmpty.max(96),
  isValid: z.boolean(),
  changeReason: ChangeReason,
});

export const adminGoalTargetPatchSchema = z.discriminatedUnion("action", [
  adminGoalTargetUpdatePatchSchema,
  adminGoalTargetValidityPatchSchema,
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formatea errores zod en un mensaje legible para usuario final.
 * Devuelve el primer error con path, p.ej. "catalogName: requerido".
 */
export function formatZodIssue(issues: z.ZodIssue[]): string {
  if (issues.length === 0) return "Cuerpo invalido.";
  const first = issues[0]!;
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}
