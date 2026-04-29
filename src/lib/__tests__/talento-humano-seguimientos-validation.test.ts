import { describe, expect, it } from "vitest";
import { createFollowupResponseSchema, updateFollowupResponseSchema } from "@/lib/talento-humano-seguimientos-schemas";
import { deriveFollowupRoute } from "@/lib/talento-humano-seguimientos-person";

// ─── Base payload válido AGR ──────────────────────────────────────────────────

const BASE_AGR = {
  uniqueFollowUpCode: "FU-001",
  followUpCode: "AGR-001",
  personId: "P-001",
  followupRouteCode: "AGR" as const,
  followupRouteSource: "scheduled_followup" as const,
  scheduledFollowUpType: "T1",
  followUpDate: "2026-04-28",
  changeReason: "initial_load",
  selections: [],
};

const BASE_ADM = {
  uniqueFollowUpCode: "FU-002",
  followUpCode: "ADM-001",
  personId: "P-002",
  followupRouteCode: "ADM" as const,
  followupRouteSource: "scheduled_followup" as const,
  scheduledFollowUpType: "T1",
  followUpDate: "2026-04-28",
  changeReason: "initial_load",
  selections: [],
};

describe("createFollowupResponseSchema", () => {
  it("acepta payload AGR mínimo válido", () => {
    const result = createFollowupResponseSchema.safeParse(BASE_AGR);
    expect(result.success).toBe(true);
  });

  it("acepta payload ADM mínimo válido", () => {
    const result = createFollowupResponseSchema.safeParse(BASE_ADM);
    expect(result.success).toBe(true);
  });

  it("acepta AGR sin frecuencia manual porque viene vinculada al seguimiento", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      agrFollowupFrequencyCode: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("acepta ADM sin frecuencia manual porque viene vinculada al seguimiento", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_ADM,
      admFollowupFrequencyCode: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza has_inconvenience=yes sin fecha y actividad", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      hasInconvenienceCode: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("acepta has_inconvenience=yes con todos los campos obligatorios", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      hasInconvenienceCode: "yes",
      inconvenienceDate: "2026-04-28",
      inconvenienceActivityCode: "harvest",
      inconvenienceTypeCode: "botrytis",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza selection 'other' sin otherDetail", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      selections: [
        { selectionGroupCode: "work_difficulty", catalogCode: "work_difficulty", itemCode: "other", otherDetail: null },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("acepta selection 'other' con otherDetail", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      selections: [
        { selectionGroupCode: "work_difficulty", catalogCode: "work_difficulty", itemCode: "other", otherDetail: "Especificación" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza 'none' mezclado con otras opciones en el mismo grupo", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      selections: [
        { selectionGroupCode: "work_difficulty", catalogCode: "work_difficulty", itemCode: "none" },
        { selectionGroupCode: "work_difficulty", catalogCode: "work_difficulty", itemCode: "missing_tools" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("acepta 'none' como única selección en el grupo", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      selections: [
        { selectionGroupCode: "work_difficulty", catalogCode: "work_difficulty", itemCode: "none" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza retentionIntention corta sin short_retention_reason selections", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      retentionIntentionCode: "less_than_3_months",
      selections: [],
    });
    expect(result.success).toBe(false);
  });

  it("acepta retentionIntention corta con short_retention_reason selection", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      retentionIntentionCode: "less_than_3_months",
      selections: [
        { selectionGroupCode: "short_retention_reason", catalogCode: "short_retention_reason", itemCode: "better_opportunities_elsewhere" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("no exige short_retention_reason para more_than_1_year", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      retentionIntentionCode: "more_than_1_year",
      selections: [],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza conflictPersonId sin conflictSituationDetail", () => {
    const result = createFollowupResponseSchema.safeParse({
      ...BASE_AGR,
      conflictPersonId: "P-999",
      conflictSituationDetail: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateFollowupResponseSchema", () => {
  it("acepta solo action update", () => {
    const result = updateFollowupResponseSchema.safeParse({
      action: "update",
      changeReason: "data_entry_error",
    });
    expect(result.success).toBe(true);
  });

  it("acepta campos parciales de correccion sin exigir payload completo", () => {
    const result = updateFollowupResponseSchema.safeParse({
      action: "update",
      changeReason: "manual_update",
      inconvenienceActivityCode: "harvest",
      inconvenienceTypeCode: "botrytis",
      selections: [
        { selectionGroupCode: "work_difficulty", catalogCode: "work_difficulty", itemCode: "missing_tools" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza acciones distintas de update", () => {
    const result = updateFollowupResponseSchema.safeParse({
      action: "delete",
      changeReason: "data_entry_error",
    });
    expect(result.success).toBe(false);
  });
});

describe("deriveFollowupRoute", () => {
  it("deriva AGR desde AGRICOLA en job_classification_code", () => {
    expect(deriveFollowupRoute(null, "AGRICOLA")).toBe("AGR");
  });

  it("deriva ADM desde ADMINISTRATIVO en job_classification_code", () => {
    expect(deriveFollowupRoute(null, "ADMINISTRATIVO")).toBe("ADM");
  });

  it("deriva desde follow_up_type cuando está disponible", () => {
    expect(deriveFollowupRoute("ADM_SEGUIMIENTO", "AGRICOLA")).toBe("ADM");
    expect(deriveFollowupRoute("AGR_TIPO_1", "ADMINISTRATIVO")).toBe("AGR");
  });

  it("hace fallback a AGR cuando no hay datos", () => {
    expect(deriveFollowupRoute(null, null)).toBe("AGR");
    expect(deriveFollowupRoute(undefined, undefined)).toBe("AGR");
  });
});
