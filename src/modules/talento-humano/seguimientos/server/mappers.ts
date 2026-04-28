import type {
  EmployeeFollowupResponseDetail,
  EmployeeFollowupResponseSummary,
  EmployeeFollowupSelectionRecord,
  FollowupResponseQueryRow,
} from "@/modules/talento-humano/seguimientos/server/types";

const SENSITIVE_FIELDS: Array<keyof FollowupResponseQueryRow> = [
  "family_pregnancy_relation_code",
  "family_pregnancy_observation",
  "hr_support_need_code",
  "hr_support_need_other_detail",
  "conflict_person_id",
  "conflict_situation_detail",
  "dissatisfaction_detail",
  "work_difficulty_observation",
  "retention_reason_observation",
  "adaptation_negative_observation",
];

export function mapResponseRowToSummary(row: FollowupResponseQueryRow): EmployeeFollowupResponseSummary {
  return {
    eventId: row.event_id,
    correctionGroupId: row.correction_group_id,
    responseVersion: row.response_version,
    isLatestValidVersion: row.is_latest_valid_version,
    uniqueFollowUpCode: row.unique_follow_up_code,
    followUpCode: row.follow_up_code,
    personId: row.person_id,
    followupRouteCode: row.followup_route_code as "AGR" | "ADM",
    followUpDate: row.follow_up_date,
    eventDate: row.event_date,
    isValid: row.is_valid,
    invalidReasonCode: row.invalid_reason_code,
    changeReason: row.change_reason,
    actorId: row.actor_id,
    loadedAt: row.loaded_at,
  };
}

export function mapResponseRowToDetail(
  row: FollowupResponseQueryRow,
  selections: EmployeeFollowupSelectionRecord[],
  includeSensitive: boolean,
): EmployeeFollowupResponseDetail {
  function sensitive<T>(value: T): T | null {
    return includeSensitive ? value : null;
  }

  return {
    ...mapResponseRowToSummary(row),
    followupRouteSource: row.followup_route_source as "scheduled_followup" | "job_classification_fallback" | "manual_admin_override",
    scheduledFollowUpType: row.scheduled_follow_up_type,
    jobClassificationCodeSnapshot: row.job_classification_code_snapshot,
    // AGR
    agrFollowupFrequencyCode: row.agr_followup_frequency_code,
    workDifficultyObservation: sensitive(row.work_difficulty_observation),
    coworkerTreatmentRatingCode: row.coworker_treatment_rating_code,
    supervisorTreatmentRatingCode: row.supervisor_treatment_rating_code,
    areaManagerTreatmentRatingCode: row.area_manager_treatment_rating_code,
    conflictPersonId: sensitive(row.conflict_person_id),
    conflictSituationDetail: sensitive(row.conflict_situation_detail),
    workLikeMostObservation: row.work_like_most_observation,
    improvementOpportunityObservation: row.improvement_opportunity_observation,
    agrSatisfactionObservation: row.agr_satisfaction_observation,
    retentionIntentionCode: row.retention_intention_code,
    retentionReasonObservation: sensitive(row.retention_reason_observation),
    hrSupportNeedCode: sensitive(row.hr_support_need_code),
    hrSupportNeedOtherDetail: sensitive(row.hr_support_need_other_detail),
    familyPregnancyRelationCode: sensitive(row.family_pregnancy_relation_code),
    familyPregnancyObservation: sensitive(row.family_pregnancy_observation),
    hasInconvenienceCode: row.has_inconvenience_code,
    inconvenienceDate: row.inconvenience_date,
    inconvenienceActivityCode: row.inconvenience_activity_code,
    inconvenienceActivityOtherDetail: row.inconvenience_activity_other_detail,
    inconvenienceTypeCode: row.inconvenience_type_code,
    inconvenienceTypeOtherDetail: row.inconvenience_type_other_detail,
    // ADM
    admFollowupFrequencyCode: row.adm_followup_frequency_code,
    inductionSufficientCode: row.induction_sufficient_code,
    transportProblemCode: row.transport_problem_code,
    teamWelcomeCode: row.team_welcome_code,
    adaptationNegativeObservation: sensitive(row.adaptation_negative_observation),
    adaptationSuggestion: row.adaptation_suggestion,
    roleClaritySatisfactionCode: row.role_clarity_satisfaction_code,
    workEnvironmentSatisfactionCode: row.work_environment_satisfaction_code,
    equipmentSatisfactionCode: row.equipment_satisfaction_code,
    probationSatisfactionSuggestion: row.probation_satisfaction_suggestion,
    recentWorkSatisfactionCode: row.recent_work_satisfaction_code,
    workAspectToImproveCode: row.work_aspect_to_improve_code,
    workAspectToImproveOtherDetail: row.work_aspect_to_improve_other_detail,
    dissatisfactionDetail: sensitive(row.dissatisfaction_detail),
    finalRetentionIntentionCode: row.final_retention_intention_code,
    finalStaySuggestion: row.final_stay_suggestion,
    // Multiselect
    selections,
  };
}

export { SENSITIVE_FIELDS };
