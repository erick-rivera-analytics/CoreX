import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const trimmed = z.string().trim();
const nullableCode = trimmed.max(64).nullish().transform((v) => v?.trim() || null);
const nullableText = (max = 2000) => trimmed.max(max).nullish().transform((v) => v?.trim() || null);
const isoDate = () =>
  trimmed.regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)");
const selectList = trimmed.max(120).optional();

// ─────────────────────────────────────────────────────────────────────────────
// Selección (multiselect bridge row)
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SELECTION_GROUPS = [
  "work_difficulty",
  "work_like_most",
  "improvement_opportunity",
  "short_retention_reason",
] as const;

export const employeeFollowupSelectionInputSchema = z.object({
  selectionGroupCode: z.enum(VALID_SELECTION_GROUPS),
  catalogCode: trimmed.max(64),
  itemCode: trimmed.max(64),
  otherDetail: nullableText(500),
  displayOrder: z.number().int().min(0).max(999).nullish().transform((v) => v ?? null),
});

export type EmployeeFollowupSelectionInput = z.infer<typeof employeeFollowupSelectionInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Crear respuesta
// ─────────────────────────────────────────────────────────────────────────────

export const createFollowupResponseSchema = z
  .object({
    uniqueFollowUpCode: trimmed.min(1).max(120),
    followUpCode: trimmed.min(1).max(120),
    personId: trimmed.min(1).max(120),
    followupRouteCode: z.enum(["AGR", "ADM"]),
    followupRouteSource: z.enum([
      "scheduled_followup",
      "job_classification_fallback",
      "manual_admin_override",
    ]),
    scheduledFollowUpType: nullableCode,
    jobClassificationCodeSnapshot: nullableCode,
    followUpDate: isoDate(),
    changeReason: trimmed.min(1).max(200),

    // ── AGR ──────────────────────────────────────────────────────────────────
    agrFollowupFrequencyCode: nullableCode,
    workDifficultyObservation: nullableText(2000),
    coworkerTreatmentRatingCode: nullableCode,
    supervisorTreatmentRatingCode: nullableCode,
    areaManagerTreatmentRatingCode: nullableCode,
    conflictPersonId: nullableCode,
    conflictSituationDetail: nullableText(2000),
    workLikeMostObservation: nullableText(2000),
    improvementOpportunityObservation: nullableText(2000),
    agrSatisfactionObservation: nullableText(2000),
    retentionIntentionCode: nullableCode,
    retentionReasonObservation: nullableText(2000),
    hrSupportNeedCode: nullableCode,
    hrSupportNeedOtherDetail: nullableText(500),
    familyPregnancyRelationCode: nullableCode,
    familyPregnancyObservation: nullableText(2000),
    hasInconvenienceCode: nullableCode,
    inconvenienceDate: isoDate().nullish().transform((v) => v || null),
    inconvenienceActivityCode: nullableCode,
    inconvenienceActivityOtherDetail: nullableText(500),
    inconvenienceTypeCode: nullableCode,
    inconvenienceTypeOtherDetail: nullableText(500),

    // ── ADM ──────────────────────────────────────────────────────────────────
    admFollowupFrequencyCode: nullableCode,
    inductionSufficientCode: nullableCode,
    transportProblemCode: nullableCode,
    teamWelcomeCode: nullableCode,
    adaptationNegativeObservation: nullableText(2000),
    adaptationSuggestion: nullableText(2000),
    roleClaritySatisfactionCode: nullableCode,
    workEnvironmentSatisfactionCode: nullableCode,
    equipmentSatisfactionCode: nullableCode,
    probationSatisfactionSuggestion: nullableText(2000),
    recentWorkSatisfactionCode: nullableCode,
    workAspectToImproveCode: nullableCode,
    workAspectToImproveOtherDetail: nullableText(500),
    dissatisfactionDetail: nullableText(2000),
    finalRetentionIntentionCode: nullableCode,
    finalStaySuggestion: nullableText(2000),

    // ── Multiselect ───────────────────────────────────────────────────────────
    selections: z.array(employeeFollowupSelectionInputSchema).default([]),
  })
  // Validaciones cross-field
  .refine(
    (v) => {
      if (v.hasInconvenienceCode === "yes") {
        return Boolean(v.inconvenienceDate) && Boolean(v.inconvenienceActivityCode) && Boolean(v.inconvenienceTypeCode);
      }
      return true;
    },
    {
      message: "Si hay novedad, son obligatorios: fecha, actividad y tipo.",
      path: ["hasInconvenienceCode"],
    },
  )
  .refine(
    (v) => {
      if (v.conflictPersonId) return Boolean(v.conflictSituationDetail);
      return true;
    },
    { message: "Al indicar una persona en conflicto, el detalle es obligatorio.", path: ["conflictSituationDetail"] },
  )
  .refine(
    (v) => {
      if (v.hrSupportNeedCode === "other") return Boolean(v.hrSupportNeedOtherDetail);
      return true;
    },
    { message: "Especificar el apoyo requerido cuando elige 'Otro'.", path: ["hrSupportNeedOtherDetail"] },
  )
  .refine(
    (v) => {
      if (v.inconvenienceActivityCode === "other") return Boolean(v.inconvenienceActivityOtherDetail);
      return true;
    },
    { message: "Especificar la actividad cuando elige 'Otro'.", path: ["inconvenienceActivityOtherDetail"] },
  )
  .refine(
    (v) => {
      if (v.inconvenienceTypeCode === "other") return Boolean(v.inconvenienceTypeOtherDetail);
      return true;
    },
    { message: "Especificar el tipo cuando elige 'Otro'.", path: ["inconvenienceTypeOtherDetail"] },
  )
  .refine(
    (v) => {
      if (v.workAspectToImproveCode === "other") return Boolean(v.workAspectToImproveOtherDetail);
      return true;
    },
    { message: "Especificar el aspecto cuando elige 'Otro'.", path: ["workAspectToImproveOtherDetail"] },
  )
  .refine(
    (v) => {
      // Si tiene intención de salir pronto, debe haber al menos una razón seleccionada
      const shortRetentionCodes = [
        "less_than_3_months",
        "between_3_and_6_months",
        "between_6_months_and_1_year",
      ];
      if (v.retentionIntentionCode && shortRetentionCodes.includes(v.retentionIntentionCode)) {
        return v.selections.some((s) => s.selectionGroupCode === "short_retention_reason");
      }
      return true;
    },
    {
      message: "Al indicar intención de salida corta, seleccionar al menos una razón.",
      path: ["selections"],
    },
  )
  .refine(
    (v) => {
      // Validar "other" en selections que lo requieren
      const groupsWithOther = ["work_difficulty", "work_like_most", "improvement_opportunity", "short_retention_reason"];
      for (const sel of v.selections) {
        if (groupsWithOther.includes(sel.selectionGroupCode) && sel.itemCode === "other" && !sel.otherDetail) {
          return false;
        }
      }
      return true;
    },
    { message: "Al seleccionar 'Otro', es obligatorio especificar el detalle.", path: ["selections"] },
  )
  .refine(
    (v) => {
      // "none" en un grupo es exclusivo: no puede haber otros items en el mismo grupo
      const groupsWithNone = ["work_difficulty", "work_like_most", "improvement_opportunity"];
      for (const group of groupsWithNone) {
        const groupSelections = v.selections.filter((s) => s.selectionGroupCode === group);
        const hasNone = groupSelections.some((s) => s.itemCode === "none");
        if (hasNone && groupSelections.length > 1) {
          return false;
        }
      }
      return true;
    },
    { message: "Al seleccionar 'Ninguno', no se puede combinar con otras opciones.", path: ["selections"] },
  );

export type CreateFollowupResponseInput = z.infer<typeof createFollowupResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar respuesta preservando historial
// ─────────────────────────────────────────────────────────────────────────────

export const updateFollowupResponseSchema = z
  .object({
    action: z.literal("update"),
    changeReason: trimmed.min(1).max(200),
    agrFollowupFrequencyCode: nullableCode,
    workDifficultyObservation: nullableText(2000),
    coworkerTreatmentRatingCode: nullableCode,
    supervisorTreatmentRatingCode: nullableCode,
    areaManagerTreatmentRatingCode: nullableCode,
    conflictPersonId: nullableCode,
    conflictSituationDetail: nullableText(2000),
    workLikeMostObservation: nullableText(2000),
    improvementOpportunityObservation: nullableText(2000),
    agrSatisfactionObservation: nullableText(2000),
    retentionIntentionCode: nullableCode,
    retentionReasonObservation: nullableText(2000),
    hrSupportNeedCode: nullableCode,
    hrSupportNeedOtherDetail: nullableText(500),
    familyPregnancyRelationCode: nullableCode,
    familyPregnancyObservation: nullableText(2000),
    hasInconvenienceCode: nullableCode,
    inconvenienceDate: isoDate().nullish().transform((v) => v || null),
    inconvenienceActivityCode: nullableCode,
    inconvenienceActivityOtherDetail: nullableText(500),
    inconvenienceTypeCode: nullableCode,
    inconvenienceTypeOtherDetail: nullableText(500),
    admFollowupFrequencyCode: nullableCode,
    inductionSufficientCode: nullableCode,
    transportProblemCode: nullableCode,
    teamWelcomeCode: nullableCode,
    adaptationNegativeObservation: nullableText(2000),
    adaptationSuggestion: nullableText(2000),
    roleClaritySatisfactionCode: nullableCode,
    workEnvironmentSatisfactionCode: nullableCode,
    equipmentSatisfactionCode: nullableCode,
    probationSatisfactionSuggestion: nullableText(2000),
    recentWorkSatisfactionCode: nullableCode,
    workAspectToImproveCode: nullableCode,
    workAspectToImproveOtherDetail: nullableText(500),
    dissatisfactionDetail: nullableText(2000),
    finalRetentionIntentionCode: nullableCode,
    finalStaySuggestion: nullableText(2000),
    selections: z.array(employeeFollowupSelectionInputSchema).optional(),
  });

export type UpdateFollowupResponseInput = z.infer<typeof updateFollowupResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Filtros de búsqueda
// ─────────────────────────────────────────────────────────────────────────────

export const followupFiltersSchema = z.object({
  asOfDate: isoDate().optional(),
  personSearch: trimmed.max(120).optional(),
  associatedWorker: trimmed.max(120).optional(),
  route: z.enum(["AGR", "ADM", ""]).optional(),
  status: z.enum(["pending", "registered", "all"]).optional(),
  year: selectList,
  month: selectList,
  dateFrom: isoDate().optional(),
  dateTo: isoDate().optional(),
  uniqueFollowUpCode: trimmed.max(120).optional(),
});

export type FollowupFiltersInput = z.infer<typeof followupFiltersSchema>;
