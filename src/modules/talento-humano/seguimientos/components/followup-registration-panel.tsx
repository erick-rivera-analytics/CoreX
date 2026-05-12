"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Save, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { cn } from "@/lib/utils";
import { FormSection } from "@/shared/forms/form-section";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { FollowupFormAdm, type AdmFormState } from "@/modules/talento-humano/seguimientos/components/followup-form-adm";
import { FollowupFormAgr, type AgrFormState } from "@/modules/talento-humano/seguimientos/components/followup-form-agr";
import { FollowupHistorySection } from "@/modules/talento-humano/seguimientos/components/followup-history-section";
import { PersonQuickCard } from "@/modules/talento-humano/seguimientos/components/person-quick-card";
import {
  ADM_REQUIRED_CATALOGS,
  AGR_REQUIRED_CATALOGS,
  CATALOG_LABELS,
  EMPTY_ADM,
  EMPTY_AGR,
  buildDV,
  hydrateAdmState,
  hydrateAgrState,
  toOpts,
} from "@/modules/talento-humano/seguimientos/components/followup-registration-state";
import type {
  EmployeeFollowupCatalogMap,
  EmployeeFollowupResponseDetail,
  EmployeeScheduledFollowupRow,
} from "@/modules/talento-humano/seguimientos/server/types";

type Permissions = { canWrite: boolean; canSensitive: boolean; canAdmin: boolean };
type Props = {
  followup: EmployeeScheduledFollowupRow;
  catalogs: EmployeeFollowupCatalogMap;
  permissions: Permissions;
  asOfDate?: string;
  onSaved: () => void;
  onClose: () => void;
};

const detailFetcher = (url: string) =>
  fetchJson<EmployeeFollowupResponseDetail>(url, "No se pudo cargar la respuesta registrada.");

const SHORT_RETENTION_CODES = [
  "less_than_3_months",
  "between_3_and_6_months",
  "between_6_months_and_1_year",
];

export function FollowupRegistrationPanel({ followup, catalogs, permissions, asOfDate, onSaved, onClose }: Props) {
  const route = followup.derivedRoute;
  const [submitting, setSubmitting] = useState(false);
  const [agrState, setAgrState] = useState<AgrFormState>(EMPTY_AGR);
  const [admState, setAdmState] = useState<AdmFormState>(EMPTY_ADM);
  const [changeReason, setChangeReason] = useState(followup.status === "registered" ? "manual_update" : "initial_load");
  const detailUrl = followup.responseEventId
    ? `/api/talento-humano/seguimientos/responses/${encodeURIComponent(followup.responseEventId)}`
    : null;
  const { data: existingDetail, isLoading: loadingDetail } = useSWR(detailUrl, detailFetcher, { revalidateOnFocus: false });

  const setAgrField = <K extends keyof AgrFormState>(key: K, value: AgrFormState[K]) =>
    setAgrState((prev) => ({ ...prev, [key]: value }));
  const setAdmField = <K extends keyof AdmFormState>(key: K, value: AdmFormState[K]) =>
    setAdmState((prev) => ({ ...prev, [key]: value }));
  const catOpts = (key: string) => toOpts(catalogs[key]);
  const catDV = (key: string) => buildDV(catalogs[key]);
  const isEditing = followup.status === "registered";
  const retentionOpts = catOpts("retention_intention");
  const retentionDV = catDV("retention_intention");
  const changeReasonOptions = catOpts("employee_followup_change_reason")
    .filter((code) => !["initial_load", "manual_insert", "backfill"].includes(code));
  const editableChangeReasonOptions = changeReasonOptions.length ? changeReasonOptions : ["manual_update"];
  const changeReasonDV = catDV("employee_followup_change_reason");
  const missingCatalogs = (route === "AGR" ? AGR_REQUIRED_CATALOGS : ADM_REQUIRED_CATALOGS)
    .filter((catalogCode) => !catalogs[catalogCode]?.length);
  const catalogsReady = missingCatalogs.length === 0;
  const scheduledFrequencyCode = followup.followUpType ?? null;

  useEffect(() => {
    setAgrState(EMPTY_AGR);
    setAdmState(EMPTY_ADM);
    setChangeReason(followup.status === "registered" ? "manual_update" : "initial_load");
  }, [followup.uniqueFollowUpCode, followup.personId, followup.status]);

  useEffect(() => {
    if (!existingDetail) return;
    if (existingDetail.followupRouteCode === "AGR") setAgrState(hydrateAgrState(existingDetail));
    if (existingDetail.followupRouteCode === "ADM") setAdmState(hydrateAdmState(existingDetail));
  }, [existingDetail]);

  function validateBeforeSubmit() {
    if (route === "AGR") {
      const hasInconvenience = agrState.hasInconvenience === "yes";
      const shortRetentionVisible = SHORT_RETENTION_CODES.includes(agrState.retentionIntention);
      const missingAgr = !decodeMultiSelectValue(agrState.workDiffEncoded).length
        || !agrState.coworkerRating || !agrState.supervisorRating || !agrState.areaManagerRating
        || !decodeMultiSelectValue(agrState.workLikeMostEncoded).length
        || !decodeMultiSelectValue(agrState.improvOppEncoded).length
        || !agrState.retentionIntention || !agrState.hrSupportNeed
        || !agrState.familyPregnancyRelation || !agrState.hasInconvenience
        || (shortRetentionVisible && !decodeMultiSelectValue(agrState.shortRetentionEncoded).length)
        || (hasInconvenience && (!agrState.inconvenienceDate || !agrState.inconvenienceActivity || !agrState.inconvenienceType));
      if (missingAgr) return "Complete las preguntas obligatorias marcadas con *.";
    }

    if (route === "ADM") {
      const missingAdm = !admState.inductionSufficient || !admState.transportProblem || !admState.teamWelcome
        || !admState.roleClarity || !admState.workEnvironment || !admState.equipmentSatisfaction
        || !admState.recentWorkSatisfaction || !admState.workAspectToImprove || !admState.finalRetentionIntention;
      if (missingAdm) return "Complete las preguntas obligatorias marcadas con *.";
    }
    return null;
  }

  function buildSelections() {
    const selections: Array<{ selectionGroupCode: string; catalogCode: string; itemCode: string; otherDetail?: string | null; displayOrder?: number }> = [];
    const addSelections = (encoded: string, groupCode: string, catalogCode: string, otherDetail: string) => {
      decodeMultiSelectValue(encoded).forEach((itemCode, displayOrder) => {
        selections.push({ selectionGroupCode: groupCode, catalogCode, itemCode, otherDetail: itemCode === "other" ? otherDetail || null : null, displayOrder });
      });
    };
    addSelections(agrState.workDiffEncoded, "work_difficulty", "work_difficulty", agrState.workDiffOther);
    addSelections(agrState.workLikeMostEncoded, "work_like_most", "work_like_most", agrState.workLikeMostOther);
    addSelections(agrState.improvOppEncoded, "improvement_opportunity", "improvement_opportunity", agrState.improvOppOther);
    if (SHORT_RETENTION_CODES.includes(agrState.retentionIntention)) {
      addSelections(agrState.shortRetentionEncoded, "short_retention_reason", "short_retention_reason", agrState.shortRetentionOther);
    }
    return selections;
  }

  async function handleSubmit() {
    if (!permissions.canWrite) { toast.error("No tienes permiso para registrar seguimientos."); return; }
    if (!catalogsReady) { toast.error("Faltan catalogos del formulario. Recarga el modulo o valida db_human_talent."); return; }
    const validationError = validateBeforeSubmit();
    if (validationError) { toast.error(validationError); return; }

    const body = {
      uniqueFollowUpCode: followup.uniqueFollowUpCode,
      followUpCode: followup.followUpCode,
      personId: followup.personId,
      followupRouteCode: route,
      followupRouteSource: "scheduled_followup",
      scheduledFollowUpType: followup.followUpType ?? null,
      jobClassificationCodeSnapshot: followup.jobClassificationCode ?? null,
      followUpDate: followup.followUpDate,
      changeReason: isEditing ? changeReason : "initial_load",
      ...(route === "AGR" && buildAgrPayload(agrState)),
      ...(route === "ADM" && buildAdmPayload(admState)),
      selections: buildSelections(),
    };

    setSubmitting(true);
    try {
      await fetchJson("/api/talento-humano/seguimientos/responses", "No se pudo registrar.", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success(isEditing ? "Seguimiento actualizado correctamente." : "Seguimiento registrado correctamente.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar el seguimiento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="starter-panel border-border/70 bg-card/84">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
              <UserCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Clasificacion {route}</Badge>
                <Badge variant={isEditing ? "success" : "outline"}>{followup.status === "pending" ? "Pendiente" : "Realizado"}</Badge>
                {scheduledFrequencyCode ? <Badge variant="secondary">Frecuencia {scheduledFrequencyCode}</Badge> : null}
              </div>
              <CardTitle className="text-lg">{followup.personName}</CardTitle>
              <CardDescription>{followup.status === "registered" ? "Editando respuesta" : "Nuevo registro"} · Seguimiento {followup.followUpDate}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar seguimiento"><X className="size-4" /></Button>
        </div>
        {loadingDetail ? <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Cargando respuestas registradas…</div> : null}
        {!catalogsReady ? <CatalogWarning missingCatalogs={missingCatalogs} /> : null}
      </CardHeader>
      <CardContent>
        <div className="max-h-[calc(100dvh-14rem)] space-y-6 overflow-y-auto pr-1">
          <PersonQuickCard personId={followup.personId} asOfDate={asOfDate} />
          <FollowupHistorySection
            personId={followup.personId}
            currentUniqueFollowUpCode={followup.uniqueFollowUpCode}
            catalogs={catalogs}
          />
          {route === "AGR" && (
            <FollowupFormAgr state={agrState} setField={setAgrField} asOfDate={asOfDate}
              ratingOpts={catOpts("treatment_rating")} ratingDV={catDV("treatment_rating")}
              yesNoOpts={catOpts("yes_no")} yesNoDV={catDV("yes_no")}
              retentionOpts={retentionOpts} retentionDV={retentionDV}
              hrSupportOpts={catOpts("hr_support_need")} hrSupportDV={catDV("hr_support_need")}
              familyOpts={catOpts("family_pregnancy_relation")} familyDV={catDV("family_pregnancy_relation")}
              activityOpts={catOpts("inconvenience_activity")} activityDV={catDV("inconvenience_activity")}
              inconvTypeOpts={catOpts("inconvenience_type")} inconvTypeDV={catDV("inconvenience_type")}
              workDiffOpts={catOpts("work_difficulty")} workDiffDV={catDV("work_difficulty")}
              workLikeMostOpts={catOpts("work_like_most")} workLikeMostDV={catDV("work_like_most")}
              improvOpts={catOpts("improvement_opportunity")} improvDV={catDV("improvement_opportunity")}
              shortRetentionOpts={catOpts("short_retention_reason")} shortRetentionDV={catDV("short_retention_reason")}
            />
          )}
          {route === "ADM" && (
            <FollowupFormAdm state={admState} setField={setAdmField}
              adaptOpts={catOpts("adaptation_response")} adaptDV={catDV("adaptation_response")}
              satisfactionOpts={catOpts("satisfaction_level")} satisfactionDV={catDV("satisfaction_level")}
              retentionOpts={retentionOpts} retentionDV={retentionDV}
              workAspectOpts={catOpts("work_aspect_to_improve")} workAspectDV={catDV("work_aspect_to_improve")}
            />
          )}
          {isEditing ? (
            <FormSection title="Auditoría">
              <SingleSelectField id="change-reason" label="Razón del cambio *" value={changeReason}
                options={editableChangeReasonOptions}
                displayValue={changeReasonDV}
                onChange={setChangeReason} omitEmpty
              />
            </FormSection>
          ) : null}
          {permissions.canWrite ? (
            <Button className="w-full rounded-full" onClick={handleSubmit} disabled={submitting || !catalogsReady}>
              <Save className={cn("size-4", submitting && "animate-pulse")} />
              {submitting ? "Guardando…" : isEditing ? "Guardar cambios" : "Registrar seguimiento"}
            </Button>
          ) : <p className="text-center text-xs text-muted-foreground">Solo lectura. No tienes permiso para registrar.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function buildAgrPayload(state: AgrFormState) {
  const hasInconvenience = state.hasInconvenience === "yes";
  return {
    workDifficultyObservation: state.workDifficultyObs || null,
    coworkerTreatmentRatingCode: state.coworkerRating || null,
    supervisorTreatmentRatingCode: state.supervisorRating || null,
    areaManagerTreatmentRatingCode: state.areaManagerRating || null,
    conflictPersonId: state.conflictPersonId || null,
    conflictSituationDetail: state.conflictDetail || null,
    workLikeMostObservation: state.workLikeMostObs || null,
    improvementOpportunityObservation: state.improvementOppObs || null,
    agrSatisfactionObservation: state.agrSatisfactionObs || null,
    retentionIntentionCode: state.retentionIntention || null,
    retentionReasonObservation: state.retentionReasonObs || null,
    hrSupportNeedCode: state.hrSupportNeed || null,
    hrSupportNeedOtherDetail: state.hrSupportOther || null,
    familyPregnancyRelationCode: state.familyPregnancyRelation || null,
    familyPregnancyObservation: state.familyPregnancyObs || null,
    developedActivitiesDescription: state.developedActivitiesDescription || null,
    hasInconvenienceCode: state.hasInconvenience || null,
    inconvenienceDate: hasInconvenience ? state.inconvenienceDate || null : null,
    inconvenienceActivityCode: hasInconvenience ? state.inconvenienceActivity || null : null,
    inconvenienceActivityOtherDetail: hasInconvenience && state.inconvenienceActivity === "other" ? state.inconvenienceActivityOther || null : null,
    inconvenienceTypeCode: hasInconvenience ? state.inconvenienceType || null : null,
    inconvenienceTypeOtherDetail: hasInconvenience && state.inconvenienceType === "other" ? state.inconvenienceTypeOther || null : null,
  };
}

function buildAdmPayload(state: AdmFormState) {
  return {
    inductionSufficientCode: state.inductionSufficient || null,
    transportProblemCode: state.transportProblem || null,
    teamWelcomeCode: state.teamWelcome || null,
    adaptationNegativeObservation: state.adaptationNegObs || null,
    adaptationSuggestion: state.adaptationSuggestion || null,
    roleClaritySatisfactionCode: state.roleClarity || null,
    workEnvironmentSatisfactionCode: state.workEnvironment || null,
    equipmentSatisfactionCode: state.equipmentSatisfaction || null,
    probationSatisfactionSuggestion: state.probationSuggestion || null,
    recentWorkSatisfactionCode: state.recentWorkSatisfaction || null,
    workAspectToImproveCode: state.workAspectToImprove || null,
    workAspectToImproveOtherDetail: state.workAspectOther || null,
    dissatisfactionDetail: state.dissatisfactionDetail || null,
    finalRetentionIntentionCode: state.finalRetentionIntention || null,
    finalStaySuggestion: state.finalStaySuggestion || null,
  };
}

function CatalogWarning({ missingCatalogs }: { missingCatalogs: string[] }) {
  return (
    <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
      <div className="flex gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">Faltan opciones del formulario.</p>
          <p className="mt-1 text-xs">Catalogos sin items: {missingCatalogs.map((catalogCode) => CATALOG_LABELS[catalogCode] ?? catalogCode).join(", ")}.</p>
        </div>
      </div>
    </div>
  );
}
