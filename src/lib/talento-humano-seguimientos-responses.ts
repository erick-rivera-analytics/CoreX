import { randomUUID } from "node:crypto";

import { queryHumanTalent, withHumanTalentTransaction } from "@/lib/human-talent-db";
import type {
  CreateFollowupResponseInput,
  UpdateFollowupResponseInput,
} from "@/lib/talento-humano-seguimientos-schemas";
import type {
  EmployeeFollowupResponseDetail,
  EmployeeFollowupResponseSummary,
  EmployeeFollowupSelectionRecord,
  FollowupResponseQueryRow,
  FollowupSelectionQueryRow,
} from "@/modules/talento-humano/seguimientos/server/types";
import { mapResponseRowToDetail, mapResponseRowToSummary } from "@/modules/talento-humano/seguimientos/server/mappers";

// ─────────────────────────────────────────────────────────────────────────────
// Lista de respuestas
// ─────────────────────────────────────────────────────────────────────────────

export async function listFollowupResponses(opts: {
  personId?: string;
  uniqueFollowUpCode?: string;
  includeAll?: boolean;
  limit?: number;
}): Promise<EmployeeFollowupResponseSummary[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let pIdx = 1;

  if (!opts.includeAll) {
    conditions.push(`r.is_latest_valid_version = true`);
  }

  if (opts.personId) {
    conditions.push(`r.person_id = $${pIdx}`);
    params.push(opts.personId);
    pIdx++;
  }

  if (opts.uniqueFollowUpCode) {
    conditions.push(`r.unique_follow_up_code = $${pIdx}`);
    params.push(opts.uniqueFollowUpCode);
    pIdx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await queryHumanTalent<FollowupResponseQueryRow>(
    `
    SELECT *
    FROM public.tthh_fact_employee_followup_response_cur r
    ${where}
    ORDER BY r.follow_up_date DESC, r.response_version DESC
    LIMIT $${pIdx}
    `,
    [...params, opts.limit ?? 200],
  );

  return result.rows.map(mapResponseRowToSummary);
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle de una respuesta
// ─────────────────────────────────────────────────────────────────────────────

export async function getFollowupResponseDetail(
  eventId: string,
  includeSensitive: boolean,
): Promise<EmployeeFollowupResponseDetail | null> {
  const [rowResult, selectionsResult] = await Promise.all([
    queryHumanTalent<FollowupResponseQueryRow>(
      `SELECT * FROM public.tthh_fact_employee_followup_response_cur WHERE event_id = $1`,
      [eventId],
    ),
    queryHumanTalent<FollowupSelectionQueryRow>(
      `
      SELECT *
      FROM public.tthh_asgn_employee_followup_catalog_selection_cur
      WHERE event_id = $1
        AND is_valid = true
      ORDER BY selection_group_code, display_order, item_code
      `,
      [eventId],
    ),
  ]);

  const row = rowResult.rows[0];
  if (!row) return null;

  const selections: EmployeeFollowupSelectionRecord[] = selectionsResult.rows.map((s) => ({
    selectionId: s.selection_id,
    eventId: s.event_id,
    selectionGroupCode: s.selection_group_code,
    catalogCode: s.catalog_code,
    itemCode: s.item_code,
    otherDetail: s.other_detail,
    displayOrder: s.display_order,
    isValid: s.is_valid,
  }));

  return mapResponseRowToDetail(row, selections, includeSensitive);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear respuesta (transaction: fact + selections)
// ─────────────────────────────────────────────────────────────────────────────

export async function createFollowupResponse(
  input: CreateFollowupResponseInput,
  actorId: string,
  runId: string,
): Promise<{ eventId: string; correctionGroupId: string }> {
  return withHumanTalentTransaction(async (client) => {
    const eventId = randomUUID();
    const correctionGroupId = randomUUID();
    const now = new Date().toISOString();
    const eventDate = now.slice(0, 10);

    await client.query(
      `
      INSERT INTO public.tthh_fact_employee_followup_response_cur (
        event_id, correction_group_id, supersedes_event_id, response_version,
        is_latest_valid_version, unique_follow_up_code, follow_up_code, person_id,
        followup_route_code, followup_route_source, scheduled_follow_up_type,
        job_classification_code_snapshot, event_at, event_date, follow_up_date,
        event_time_precision, event_at_imputed,
        agr_followup_frequency_code, work_difficulty_observation,
        coworker_treatment_rating_code, supervisor_treatment_rating_code,
        area_manager_treatment_rating_code, conflict_person_id, conflict_situation_detail,
        work_like_most_observation, improvement_opportunity_observation,
        agr_satisfaction_observation, retention_intention_code,
        retention_reason_observation, hr_support_need_code, hr_support_need_other_detail,
        family_pregnancy_relation_code, family_pregnancy_observation,
        has_inconvenience_code, inconvenience_date, inconvenience_activity_code,
        inconvenience_activity_other_detail, inconvenience_type_code,
        inconvenience_type_other_detail,
        adm_followup_frequency_code, induction_sufficient_code, transport_problem_code,
        team_welcome_code, adaptation_negative_observation, adaptation_suggestion,
        role_clarity_satisfaction_code, work_environment_satisfaction_code,
        equipment_satisfaction_code, probation_satisfaction_suggestion,
        recent_work_satisfaction_code, work_aspect_to_improve_code,
        work_aspect_to_improve_other_detail, dissatisfaction_detail,
        final_retention_intention_code, final_stay_suggestion,
        source_system, is_valid, loaded_at, run_id, actor_id, change_reason
      ) VALUES (
        $1, $2, NULL, 1,
        true, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        'date', true,
        $13, $14,
        $15, $16,
        $17, $18, $19,
        $20, $21,
        $22, $23,
        $24, $25, $26,
        $27, $28,
        $29, $30, $31,
        $32, $33,
        $34,
        $35, $36, $37,
        $38, $39, $40,
        $41, $42,
        $43, $44,
        $45, $46,
        $47, $48,
        $49, $50,
        'corex', true, $51, $52, $53, $54
      )
      `,
      [
        eventId, correctionGroupId,
        input.uniqueFollowUpCode, input.followUpCode, input.personId,
        input.followupRouteCode, input.followupRouteSource, input.scheduledFollowUpType ?? null,
        input.jobClassificationCodeSnapshot ?? null,
        now, eventDate, input.followUpDate,
        input.agrFollowupFrequencyCode ?? null, input.workDifficultyObservation ?? null,
        input.coworkerTreatmentRatingCode ?? null, input.supervisorTreatmentRatingCode ?? null,
        input.areaManagerTreatmentRatingCode ?? null, input.conflictPersonId ?? null, input.conflictSituationDetail ?? null,
        input.workLikeMostObservation ?? null, input.improvementOpportunityObservation ?? null,
        input.agrSatisfactionObservation ?? null, input.retentionIntentionCode ?? null,
        input.retentionReasonObservation ?? null, input.hrSupportNeedCode ?? null, input.hrSupportNeedOtherDetail ?? null,
        input.familyPregnancyRelationCode ?? null, input.familyPregnancyObservation ?? null,
        input.hasInconvenienceCode ?? null, input.inconvenienceDate ?? null, input.inconvenienceActivityCode ?? null,
        input.inconvenienceActivityOtherDetail ?? null, input.inconvenienceTypeCode ?? null,
        input.inconvenienceTypeOtherDetail ?? null,
        input.admFollowupFrequencyCode ?? null, input.inductionSufficientCode ?? null, input.transportProblemCode ?? null,
        input.teamWelcomeCode ?? null, input.adaptationNegativeObservation ?? null, input.adaptationSuggestion ?? null,
        input.roleClaritySatisfactionCode ?? null, input.workEnvironmentSatisfactionCode ?? null,
        input.equipmentSatisfactionCode ?? null, input.probationSatisfactionSuggestion ?? null,
        input.recentWorkSatisfactionCode ?? null, input.workAspectToImproveCode ?? null,
        input.workAspectToImproveOtherDetail ?? null, input.dissatisfactionDetail ?? null,
        input.finalRetentionIntentionCode ?? null, input.finalStaySuggestion ?? null,
        now, runId, actorId, input.changeReason,
      ],
    );

    // Insertar selecciones
    if (input.selections.length > 0) {
      for (const sel of input.selections) {
        await client.query(
          `
          INSERT INTO public.tthh_asgn_employee_followup_catalog_selection_cur (
            selection_id, event_id, selection_group_code, catalog_code, item_code,
            other_detail, display_order, is_valid, loaded_at, run_id, actor_id, change_reason
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11)
          `,
          [
            randomUUID(), eventId,
            sel.selectionGroupCode, sel.catalogCode, sel.itemCode,
            sel.otherDetail ?? null, sel.displayOrder ?? null,
            now, runId, actorId, input.changeReason,
          ],
        );
      }
    }

    return { eventId, correctionGroupId };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar respuesta (crea nueva version, preserva historia)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateFollowupResponse(
  eventId: string,
  input: UpdateFollowupResponseInput,
  actorId: string,
  runId: string,
): Promise<{ newEventId: string; newVersion: number }> {
  return withHumanTalentTransaction(async (client) => {
    // Leer version actual
    const currentResult = await client.query<FollowupResponseQueryRow>(
      `SELECT * FROM public.tthh_fact_employee_followup_response_cur WHERE event_id = $1`,
      [eventId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error(`Respuesta no encontrada: ${eventId}`);
    if (!current.is_latest_valid_version) {
      throw new Error("Solo se puede modificar la ultima version vigente.");
    }

    const newEventId = randomUUID();
    const newVersion = current.response_version + 1;
    const now = new Date().toISOString();
    const eventDate = now.slice(0, 10);

    // La correccion siempre crea una nueva version vigente.
    const isValid = true;
    const invalidReasonCode = null;

    // Marcar version anterior como historica e invalida sin borrarla.
    await client.query(
      `UPDATE public.tthh_fact_employee_followup_response_cur
       SET is_latest_valid_version = false,
           is_valid = false,
           invalid_reason_code = COALESCE(invalid_reason_code, 'superseded_by_update'),
           change_reason = $2,
           actor_id = $3,
           run_id = $4
       WHERE event_id = $1`,
      [eventId, input.changeReason, actorId, runId],
    );

    // Mezclar campos nuevos con la version actual.
    const pick = <T>(nextValue: T | null | undefined, currentValue: T | null) =>
      nextValue === undefined ? currentValue : nextValue;

    // Insertar nueva version.
    await client.query(
      `
      INSERT INTO public.tthh_fact_employee_followup_response_cur (
        event_id, correction_group_id, supersedes_event_id, response_version,
        is_latest_valid_version, unique_follow_up_code, follow_up_code, person_id,
        followup_route_code, followup_route_source, scheduled_follow_up_type,
        job_classification_code_snapshot, event_at, event_date, follow_up_date,
        event_time_precision, event_at_imputed,
        agr_followup_frequency_code, work_difficulty_observation,
        coworker_treatment_rating_code, supervisor_treatment_rating_code,
        area_manager_treatment_rating_code, conflict_person_id, conflict_situation_detail,
        work_like_most_observation, improvement_opportunity_observation,
        agr_satisfaction_observation, retention_intention_code,
        retention_reason_observation, hr_support_need_code, hr_support_need_other_detail,
        family_pregnancy_relation_code, family_pregnancy_observation,
        has_inconvenience_code, inconvenience_date, inconvenience_activity_code,
        inconvenience_activity_other_detail, inconvenience_type_code,
        inconvenience_type_other_detail,
        adm_followup_frequency_code, induction_sufficient_code, transport_problem_code,
        team_welcome_code, adaptation_negative_observation, adaptation_suggestion,
        role_clarity_satisfaction_code, work_environment_satisfaction_code,
        equipment_satisfaction_code, probation_satisfaction_suggestion,
        recent_work_satisfaction_code, work_aspect_to_improve_code,
        work_aspect_to_improve_other_detail, dissatisfaction_detail,
        final_retention_intention_code, final_stay_suggestion,
        source_system, is_valid, invalid_reason_code, loaded_at, run_id, actor_id, change_reason
      ) VALUES (
        $1, $2, $3, $4,
        true, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14,
        'date', true,
        $15, $16, $17, $18,
        $19, $20, $21,
        $22, $23,
        $24, $25,
        $26, $27, $28,
        $29, $30,
        $31, $32, $33,
        $34, $35,
        $36,
        $37, $38, $39,
        $40, $41, $42,
        $43, $44,
        $45, $46,
        $47, $48,
        $49, $50,
        'corex', $51, $52, $53, $54, $55, $56
      )
      `,
      [
        newEventId, current.correction_group_id, eventId, newVersion,
        current.unique_follow_up_code, current.follow_up_code, current.person_id,
        current.followup_route_code, current.followup_route_source, current.scheduled_follow_up_type,
        current.job_classification_code_snapshot,
        now, eventDate, current.follow_up_date,
        pick(input.agrFollowupFrequencyCode, current.agr_followup_frequency_code),
        pick(input.workDifficultyObservation, current.work_difficulty_observation),
        pick(input.coworkerTreatmentRatingCode, current.coworker_treatment_rating_code),
        pick(input.supervisorTreatmentRatingCode, current.supervisor_treatment_rating_code),
        pick(input.areaManagerTreatmentRatingCode, current.area_manager_treatment_rating_code),
        pick(input.conflictPersonId, current.conflict_person_id),
        pick(input.conflictSituationDetail, current.conflict_situation_detail),
        pick(input.workLikeMostObservation, current.work_like_most_observation),
        pick(input.improvementOpportunityObservation, current.improvement_opportunity_observation),
        pick(input.agrSatisfactionObservation, current.agr_satisfaction_observation),
        pick(input.retentionIntentionCode, current.retention_intention_code),
        pick(input.retentionReasonObservation, current.retention_reason_observation),
        pick(input.hrSupportNeedCode, current.hr_support_need_code),
        pick(input.hrSupportNeedOtherDetail, current.hr_support_need_other_detail),
        pick(input.familyPregnancyRelationCode, current.family_pregnancy_relation_code),
        pick(input.familyPregnancyObservation, current.family_pregnancy_observation),
        pick(input.hasInconvenienceCode, current.has_inconvenience_code),
        pick(input.inconvenienceDate, current.inconvenience_date),
        pick(input.inconvenienceActivityCode, current.inconvenience_activity_code),
        pick(input.inconvenienceActivityOtherDetail, current.inconvenience_activity_other_detail),
        pick(input.inconvenienceTypeCode, current.inconvenience_type_code),
        pick(input.inconvenienceTypeOtherDetail, current.inconvenience_type_other_detail),
        pick(input.admFollowupFrequencyCode, current.adm_followup_frequency_code),
        pick(input.inductionSufficientCode, current.induction_sufficient_code),
        pick(input.transportProblemCode, current.transport_problem_code),
        pick(input.teamWelcomeCode, current.team_welcome_code),
        pick(input.adaptationNegativeObservation, current.adaptation_negative_observation),
        pick(input.adaptationSuggestion, current.adaptation_suggestion),
        pick(input.roleClaritySatisfactionCode, current.role_clarity_satisfaction_code),
        pick(input.workEnvironmentSatisfactionCode, current.work_environment_satisfaction_code),
        pick(input.equipmentSatisfactionCode, current.equipment_satisfaction_code),
        pick(input.probationSatisfactionSuggestion, current.probation_satisfaction_suggestion),
        pick(input.recentWorkSatisfactionCode, current.recent_work_satisfaction_code),
        pick(input.workAspectToImproveCode, current.work_aspect_to_improve_code),
        pick(input.workAspectToImproveOtherDetail, current.work_aspect_to_improve_other_detail),
        pick(input.dissatisfactionDetail, current.dissatisfaction_detail),
        pick(input.finalRetentionIntentionCode, current.final_retention_intention_code),
        pick(input.finalStaySuggestion, current.final_stay_suggestion),
        isValid, invalidReasonCode, now, runId, actorId, input.changeReason,
      ],
    );

    // Si no llegan selecciones nuevas, se copian las vigentes de la version anterior.
    type SelectionItem = { selectionGroupCode: string; catalogCode: string; itemCode: string; otherDetail?: string | null; displayOrder?: number | null };
    const rawSelections = (input as Record<string, unknown>)["selections"];
    const selectionRows = Array.isArray(rawSelections)
      ? rawSelections as SelectionItem[]
      : (await client.query<FollowupSelectionQueryRow>(
          `
          SELECT *
          FROM public.tthh_asgn_employee_followup_catalog_selection_cur
          WHERE event_id = $1 AND is_valid = true
          ORDER BY selection_group_code, display_order, item_code
          `,
          [eventId],
        )).rows.map((selection) => ({
          selectionGroupCode: selection.selection_group_code,
          catalogCode: selection.catalog_code,
          itemCode: selection.item_code,
          otherDetail: selection.other_detail,
          displayOrder: selection.display_order,
        }));

    await client.query(
      `UPDATE public.tthh_asgn_employee_followup_catalog_selection_cur
       SET is_valid = false, change_reason = $1, actor_id = $2, run_id = $3
       WHERE event_id = $4 AND is_valid = true`,
      [input.changeReason, actorId, runId, eventId],
    );

    for (const sel of selectionRows) {
      await client.query(
        `
        INSERT INTO public.tthh_asgn_employee_followup_catalog_selection_cur (
          selection_id, event_id, selection_group_code, catalog_code, item_code,
          other_detail, display_order, is_valid, loaded_at, run_id, actor_id, change_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11)
        `,
        [
          randomUUID(), newEventId,
          sel.selectionGroupCode, sel.catalogCode, sel.itemCode,
          sel.otherDetail ?? null, sel.displayOrder ?? null,
          now, runId, actorId, input.changeReason,
        ],
      );
    }

    return { newEventId, newVersion };
  });
}
