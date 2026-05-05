// ─────────────────────────────────────────────────────────────────────────────
// Tipos del módulo Seguimientos Trabajo Social / TTHH
// Convención: DB rows → *QueryRow  |  API payloads → *Payload  |  props → *Props
// ─────────────────────────────────────────────────────────────────────────────

export type EmployeeFollowupRouteCode = "AGR" | "ADM";

export type EmployeeFollowupRouteSource = "scheduled_followup" | "job_classification_fallback" | "manual_admin_override";

export type EmployeeFollowupStatus = "pending" | "registered";

export type EmployeeFollowupCatalogOption = {
  itemCode: string;
  itemLabelEs: string;
  displayOrder: number;
};

export type EmployeeFollowupCatalogMap = Record<string, EmployeeFollowupCatalogOption[]>;

// ─── Boot payload ─────────────────────────────────────────────────────────────

export type EmployeeFollowupBootPayload = {
  catalogs: EmployeeFollowupCatalogMap;
  options: {
    routes: Array<{ value: string; label: string }>;
    associatedWorkers: string[];
    areas: string[];
    years: string[];
    months: string[];
    statuses: Array<{ value: EmployeeFollowupStatus; label: string }>;
  };
  permissions: {
    canWrite: boolean;
    canSensitive: boolean;
    canAdmin: boolean;
  };
};

// ─── Person ───────────────────────────────────────────────────────────────────

export type EmployeeFollowupPersonSearchResult = {
  personId: string;
  personName: string;
  gender: string | null;
  jobTitle: string | null;
  jobClassificationCode: string | null;
  associatedWorkerName: string | null;
  lastEntryDate: string | null;
};

export type EmployeeFollowupPersonDetail = EmployeeFollowupPersonSearchResult & {
  maritalStatus: string | null;
  city: string | null;
  employerName: string | null;
  areaId: string | null;
  areaName: string | null;
  areaGeneral: string | null;
};

// ─── Scheduled followup ───────────────────────────────────────────────────────

export type EmployeeScheduledFollowupRow = {
  personId: string;
  personName: string;
  followUpType: string | null;
  followUpCode: string;
  uniqueFollowUpCode: string;
  followUpDate: string;
  associatedWorkerName: string | null;
  areaId: string | null;
  areaName: string | null;
  areaGeneral: string | null;
  jobClassificationCode: string | null;
  derivedRoute: EmployeeFollowupRouteCode;
  status: EmployeeFollowupStatus;
  responseEventId: string | null;
};

// ─── Selections (multiselect bridge) ─────────────────────────────────────────

export type EmployeeFollowupSelectionInput = {
  selectionGroupCode: string;
  catalogCode: string;
  itemCode: string;
  otherDetail?: string | null;
  displayOrder?: number | null;
};

export type EmployeeFollowupSelectionRecord = EmployeeFollowupSelectionInput & {
  selectionId: string;
  eventId: string;
  isValid: boolean;
};

// ─── Response records ─────────────────────────────────────────────────────────

export type EmployeeFollowupResponseSummary = {
  eventId: string;
  correctionGroupId: string;
  responseVersion: number;
  isLatestValidVersion: boolean;
  uniqueFollowUpCode: string;
  followUpCode: string;
  personId: string;
  personName?: string | null;
  followupRouteCode: EmployeeFollowupRouteCode;
  followUpDate: string;
  eventDate: string;
  isValid: boolean;
  invalidReasonCode: string | null;
  changeReason: string;
  actorId: string | null;
  loadedAt: string;
};

export type EmployeeFollowupResponseDetail = EmployeeFollowupResponseSummary & {
  followupRouteSource: EmployeeFollowupRouteSource;
  scheduledFollowUpType: string | null;
  jobClassificationCodeSnapshot: string | null;
  // AGR fields
  workDifficultyObservation: string | null;
  coworkerTreatmentRatingCode: string | null;
  supervisorTreatmentRatingCode: string | null;
  areaManagerTreatmentRatingCode: string | null;
  conflictPersonId: string | null;       // sensitive
  conflictSituationDetail: string | null; // sensitive
  workLikeMostObservation: string | null;
  improvementOpportunityObservation: string | null;
  agrSatisfactionObservation: string | null;
  retentionIntentionCode: string | null;
  retentionReasonObservation: string | null; // sensitive
  hrSupportNeedCode: string | null;          // sensitive
  hrSupportNeedOtherDetail: string | null;   // sensitive
  familyPregnancyRelationCode: string | null; // sensitive
  familyPregnancyObservation: string | null;  // sensitive
  developedActivitiesDescription: string | null;
  hasInconvenienceCode: string | null;
  inconvenienceDate: string | null;
  inconvenienceActivityCode: string | null;
  inconvenienceActivityOtherDetail: string | null;
  inconvenienceTypeCode: string | null;
  inconvenienceTypeOtherDetail: string | null;
  // ADM fields
  inductionSufficientCode: string | null;
  transportProblemCode: string | null;
  teamWelcomeCode: string | null;
  adaptationNegativeObservation: string | null; // sensitive
  adaptationSuggestion: string | null;
  roleClaritySatisfactionCode: string | null;
  workEnvironmentSatisfactionCode: string | null;
  equipmentSatisfactionCode: string | null;
  probationSatisfactionSuggestion: string | null;
  recentWorkSatisfactionCode: string | null;
  workAspectToImproveCode: string | null;
  workAspectToImproveOtherDetail: string | null;
  dissatisfactionDetail: string | null; // sensitive
  finalRetentionIntentionCode: string | null;
  finalStaySuggestion: string | null;
  // Multiselect
  selections: EmployeeFollowupSelectionRecord[];
};

// ─── Form input ───────────────────────────────────────────────────────────────

export type EmployeeFollowupResponseInput = {
  uniqueFollowUpCode: string;
  followUpCode: string;
  personId: string;
  followupRouteCode: EmployeeFollowupRouteCode;
  followupRouteSource: EmployeeFollowupRouteSource;
  scheduledFollowUpType?: string | null;
  jobClassificationCodeSnapshot?: string | null;
  followUpDate: string;
  changeReason: string;
  // AGR
  workDifficultyObservation?: string | null;
  coworkerTreatmentRatingCode?: string | null;
  supervisorTreatmentRatingCode?: string | null;
  areaManagerTreatmentRatingCode?: string | null;
  conflictPersonId?: string | null;
  conflictSituationDetail?: string | null;
  workLikeMostObservation?: string | null;
  improvementOpportunityObservation?: string | null;
  agrSatisfactionObservation?: string | null;
  retentionIntentionCode?: string | null;
  retentionReasonObservation?: string | null;
  hrSupportNeedCode?: string | null;
  hrSupportNeedOtherDetail?: string | null;
  familyPregnancyRelationCode?: string | null;
  familyPregnancyObservation?: string | null;
  developedActivitiesDescription?: string | null;
  hasInconvenienceCode?: string | null;
  inconvenienceDate?: string | null;
  inconvenienceActivityCode?: string | null;
  inconvenienceActivityOtherDetail?: string | null;
  inconvenienceTypeCode?: string | null;
  inconvenienceTypeOtherDetail?: string | null;
  // ADM
  inductionSufficientCode?: string | null;
  transportProblemCode?: string | null;
  teamWelcomeCode?: string | null;
  adaptationNegativeObservation?: string | null;
  adaptationSuggestion?: string | null;
  roleClaritySatisfactionCode?: string | null;
  workEnvironmentSatisfactionCode?: string | null;
  equipmentSatisfactionCode?: string | null;
  probationSatisfactionSuggestion?: string | null;
  recentWorkSatisfactionCode?: string | null;
  workAspectToImproveCode?: string | null;
  workAspectToImproveOtherDetail?: string | null;
  dissatisfactionDetail?: string | null;
  finalRetentionIntentionCode?: string | null;
  finalStaySuggestion?: string | null;
  // Multiselect
  selections: EmployeeFollowupSelectionInput[];
};

export type EmployeeFollowupUpdateInput = {
  action: "update";
  changeReason: string;
} & Partial<EmployeeFollowupResponseInput>;

// ─── Filters ──────────────────────────────────────────────────────────────────

export type EmployeeFollowupFilters = {
  asOfDate: string;
  personSearch?: string;
  associatedWorker?: string;
  area?: string;
  route?: string;
  status?: string;
  year?: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  uniqueFollowUpCode?: string;
};

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export type EmployeeFollowupKpis = {
  totalScheduled: number;
  totalPending: number;
  totalRegistered: number;
};

// ─── DB Query rows ────────────────────────────────────────────────────────────

export type FollowupResponseQueryRow = {
  event_id: string;
  correction_group_id: string;
  supersedes_event_id: string | null;
  response_version: number;
  is_latest_valid_version: boolean;
  unique_follow_up_code: string;
  follow_up_code: string;
  person_id: string;
  followup_route_code: string;
  followup_route_source: string;
  scheduled_follow_up_type: string | null;
  job_classification_code_snapshot: string | null;
  event_at: string;
  event_date: string;
  follow_up_date: string;
  work_difficulty_observation: string | null;
  coworker_treatment_rating_code: string | null;
  supervisor_treatment_rating_code: string | null;
  area_manager_treatment_rating_code: string | null;
  conflict_person_id: string | null;
  conflict_situation_detail: string | null;
  work_like_most_observation: string | null;
  improvement_opportunity_observation: string | null;
  agr_satisfaction_observation: string | null;
  retention_intention_code: string | null;
  retention_reason_observation: string | null;
  hr_support_need_code: string | null;
  hr_support_need_other_detail: string | null;
  family_pregnancy_relation_code: string | null;
  family_pregnancy_observation: string | null;
  developed_activities_description: string | null;
  has_inconvenience_code: string | null;
  inconvenience_date: string | null;
  inconvenience_activity_code: string | null;
  inconvenience_activity_other_detail: string | null;
  inconvenience_type_code: string | null;
  inconvenience_type_other_detail: string | null;
  induction_sufficient_code: string | null;
  transport_problem_code: string | null;
  team_welcome_code: string | null;
  adaptation_negative_observation: string | null;
  adaptation_suggestion: string | null;
  role_clarity_satisfaction_code: string | null;
  work_environment_satisfaction_code: string | null;
  equipment_satisfaction_code: string | null;
  probation_satisfaction_suggestion: string | null;
  recent_work_satisfaction_code: string | null;
  work_aspect_to_improve_code: string | null;
  work_aspect_to_improve_other_detail: string | null;
  dissatisfaction_detail: string | null;
  final_retention_intention_code: string | null;
  final_stay_suggestion: string | null;
  is_valid: boolean;
  invalid_reason_code: string | null;
  loaded_at: string;
  actor_id: string | null;
  change_reason: string;
};

export type FollowupSelectionQueryRow = {
  selection_id: string;
  event_id: string;
  selection_group_code: string;
  catalog_code: string;
  item_code: string;
  other_detail: string | null;
  display_order: number | null;
  is_valid: boolean;
};

export type CatalogItemQueryRow = {
  catalog_code: string;
  item_code: string;
  item_label_es: string;
  display_order: number;
};

export type PersonProfileQueryRow = {
  person_id: string;
  person_name: string;
  gender: string | null;
  marital_status: string | null;
  city: string | null;
  job_title: string | null;
  employer_name: string | null;
  job_classification_code: string | null;
  associated_worker_name: string | null;
  last_entry_date: string | null;
};

export type ScheduledFollowupQueryRow = {
  person_id: string;
  follow_up_type: string | null;
  follow_up_code: string;
  follow_up_date: string;
  unique_follow_up_code: string;
};
