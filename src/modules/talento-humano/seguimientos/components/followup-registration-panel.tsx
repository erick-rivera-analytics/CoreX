"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { Button } from "@/shared/ui/button";
import { FormSection } from "@/shared/forms/form-section";
import { SingleSelectField } from "@/shared/filters/single-select-field";

import { PersonQuickCard } from "@/modules/talento-humano/seguimientos/components/person-quick-card";
import { FollowupFormAgr, type AgrFormState } from "@/modules/talento-humano/seguimientos/components/followup-form-agr";
import { FollowupFormAdm, type AdmFormState } from "@/modules/talento-humano/seguimientos/components/followup-form-adm";
import type {
  EmployeeFollowupCatalogMap,
  EmployeeFollowupCatalogOption,
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

function toOpts(items: EmployeeFollowupCatalogOption[] = []): string[] {
  return items.map((i) => i.itemCode);
}
function buildDV(items: EmployeeFollowupCatalogOption[] = []) {
  const map = new Map(items.map((i) => [i.itemCode, i.itemLabelEs]));
  return (code: string) => map.get(code) ?? code;
}

const EMPTY_AGR: AgrFormState = {
  agrFreq: "", workDiffEncoded: "", workDifficultyObs: "",
  coworkerRating: "", supervisorRating: "", areaManagerRating: "",
  conflictPersonId: "", conflictDetail: "",
  workLikeMostEncoded: "", workLikeMostObs: "",
  improvOppEncoded: "", improvementOppObs: "", agrSatisfactionObs: "",
  retentionIntention: "", retentionReasonObs: "", shortRetentionEncoded: "",
  hrSupportNeed: "", hrSupportOther: "",
  familyPregnancyRelation: "", familyPregnancyObs: "",
  hasInconvenience: "", inconvenienceDate: "",
  inconvenienceActivity: "", inconvenienceActivityOther: "",
  inconvenienceType: "", inconvenienceTypeOther: "",
};

const EMPTY_ADM: AdmFormState = {
  admFreq: "", inductionSufficient: "", transportProblem: "", teamWelcome: "",
  adaptationNegObs: "", adaptationSuggestion: "",
  roleClarity: "", workEnvironment: "", equipmentSatisfaction: "",
  probationSuggestion: "", recentWorkSatisfaction: "",
  workAspectToImprove: "", workAspectOther: "",
  dissatisfactionDetail: "", finalRetentionIntention: "", finalStaySuggestion: "",
};

export function FollowupRegistrationPanel({ followup, catalogs, permissions, asOfDate, onSaved, onClose }: Props) {
  const route = followup.derivedRoute;
  const [submitting, setSubmitting] = useState(false);
  const [agrState, setAgrState] = useState<AgrFormState>(EMPTY_AGR);
  const [admState, setAdmState] = useState<AdmFormState>(EMPTY_ADM);
  const [changeReason, setChangeReason] = useState("initial_load");

  function setAgrField<K extends keyof AgrFormState>(key: K, value: AgrFormState[K]) {
    setAgrState((prev) => ({ ...prev, [key]: value }));
  }
  function setAdmField<K extends keyof AdmFormState>(key: K, value: AdmFormState[K]) {
    setAdmState((prev) => ({ ...prev, [key]: value }));
  }

  const retentionOpts = toOpts(catalogs["retention_intention"]);
  const retentionDV = buildDV(catalogs["retention_intention"]);

  async function handleSubmit() {
    if (!permissions.canWrite) { toast.error("No tienes permiso para registrar seguimientos."); return; }

    const agr = agrState;
    const adm = admState;

    const selections: Array<{ selectionGroupCode: string; catalogCode: string; itemCode: string; displayOrder?: number }> = [];
    decodeMultiSelectValue(agr.workDiffEncoded).forEach((c, i) => selections.push({ selectionGroupCode: "work_difficulty", catalogCode: "work_difficulty", itemCode: c, displayOrder: i }));
    decodeMultiSelectValue(agr.workLikeMostEncoded).forEach((c, i) => selections.push({ selectionGroupCode: "work_like_most", catalogCode: "work_like_most", itemCode: c, displayOrder: i }));
    decodeMultiSelectValue(agr.improvOppEncoded).forEach((c, i) => selections.push({ selectionGroupCode: "improvement_opportunity", catalogCode: "improvement_opportunity", itemCode: c, displayOrder: i }));
    decodeMultiSelectValue(agr.shortRetentionEncoded).forEach((c, i) => selections.push({ selectionGroupCode: "short_retention_reason", catalogCode: "short_retention_reason", itemCode: c, displayOrder: i }));

    const body = {
      uniqueFollowUpCode: followup.uniqueFollowUpCode,
      followUpCode: followup.followUpCode,
      personId: followup.personId,
      followupRouteCode: route,
      followupRouteSource: "scheduled_followup",
      scheduledFollowUpType: followup.followUpType ?? null,
      jobClassificationCodeSnapshot: followup.jobClassificationCode ?? null,
      followUpDate: followup.followUpDate,
      changeReason,
      ...(route === "AGR" && {
        agrFollowupFrequencyCode: agr.agrFreq || null,
        workDifficultyObservation: agr.workDifficultyObs || null,
        coworkerTreatmentRatingCode: agr.coworkerRating || null,
        supervisorTreatmentRatingCode: agr.supervisorRating || null,
        areaManagerTreatmentRatingCode: agr.areaManagerRating || null,
        conflictPersonId: agr.conflictPersonId || null,
        conflictSituationDetail: agr.conflictDetail || null,
        workLikeMostObservation: agr.workLikeMostObs || null,
        improvementOpportunityObservation: agr.improvementOppObs || null,
        agrSatisfactionObservation: agr.agrSatisfactionObs || null,
        retentionIntentionCode: agr.retentionIntention || null,
        retentionReasonObservation: agr.retentionReasonObs || null,
        hrSupportNeedCode: agr.hrSupportNeed || null,
        hrSupportNeedOtherDetail: agr.hrSupportOther || null,
        familyPregnancyRelationCode: agr.familyPregnancyRelation || null,
        familyPregnancyObservation: agr.familyPregnancyObs || null,
        hasInconvenienceCode: agr.hasInconvenience || null,
        inconvenienceDate: agr.inconvenienceDate || null,
        inconvenienceActivityCode: agr.inconvenienceActivity || null,
        inconvenienceActivityOtherDetail: agr.inconvenienceActivityOther || null,
        inconvenienceTypeCode: agr.inconvenienceType || null,
        inconvenienceTypeOtherDetail: agr.inconvenienceTypeOther || null,
      }),
      ...(route === "ADM" && {
        admFollowupFrequencyCode: adm.admFreq || null,
        inductionSufficientCode: adm.inductionSufficient || null,
        transportProblemCode: adm.transportProblem || null,
        teamWelcomeCode: adm.teamWelcome || null,
        adaptationNegativeObservation: adm.adaptationNegObs || null,
        adaptationSuggestion: adm.adaptationSuggestion || null,
        roleClaritySatisfactionCode: adm.roleClarity || null,
        workEnvironmentSatisfactionCode: adm.workEnvironment || null,
        equipmentSatisfactionCode: adm.equipmentSatisfaction || null,
        probationSatisfactionSuggestion: adm.probationSuggestion || null,
        recentWorkSatisfactionCode: adm.recentWorkSatisfaction || null,
        workAspectToImproveCode: adm.workAspectToImprove || null,
        workAspectToImproveOtherDetail: adm.workAspectOther || null,
        dissatisfactionDetail: adm.dissatisfactionDetail || null,
        finalRetentionIntentionCode: adm.finalRetentionIntention || null,
        finalStaySuggestion: adm.finalStaySuggestion || null,
      }),
      selections,
    };

    setSubmitting(true);
    try {
      await fetchJson("/api/talento-humano/seguimientos/responses", "No se pudo registrar.", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("Seguimiento registrado correctamente.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al registrar el seguimiento.");
    } finally {
      setSubmitting(false);
    }
  }

  const catOpts = (k: string) => toOpts(catalogs[k]);
  const catDV = (k: string) => buildDV(catalogs[k]);

  return (
    <div className="rounded-lg border bg-card overflow-y-auto max-h-[80vh]">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="font-semibold text-sm">{followup.personName}</p>
          <p className="text-xs text-muted-foreground">Ruta {route} · {followup.followUpDate}{followup.associatedWorkerName ? ` · ${followup.associatedWorkerName}` : ""}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="p-4 space-y-6">
        <PersonQuickCard personId={followup.personId} asOfDate={asOfDate} />

        {route === "AGR" && (
          <FollowupFormAgr
            state={agrState} setField={setAgrField}
            agrFreqOpts={catOpts("agr_followup_frequency")} agrFreqDV={catDV("agr_followup_frequency")}
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
          <FollowupFormAdm
            state={admState} setField={setAdmField}
            admFreqOpts={catOpts("adm_followup_frequency")} admFreqDV={catDV("adm_followup_frequency")}
            yesNoOpts={catOpts("yes_no")} yesNoDV={catDV("yes_no")}
            adaptOpts={catOpts("adaptation_response")} adaptDV={catDV("adaptation_response")}
            satisfactionOpts={catOpts("satisfaction_level")} satisfactionDV={catDV("satisfaction_level")}
            retentionOpts={retentionOpts} retentionDV={retentionDV}
            workAspectOpts={catOpts("work_aspect_to_improve")} workAspectDV={catDV("work_aspect_to_improve")}
          />
        )}

        <FormSection title="Auditoría">
          <SingleSelectField
            id="change-reason"
            label="Razón de registro"
            value={changeReason}
            options={["initial_load", "manual_insert", "form_resubmission"]}
            displayValue={(v) => ({ initial_load: "Registro inicial", manual_insert: "Inserción manual", form_resubmission: "Re-envío de formulario" }[v] ?? v)}
            onChange={setChangeReason}
            omitEmpty
          />
        </FormSection>

        {permissions.canWrite ? (
          <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Registrar seguimiento"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground text-center">Solo lectura. No tienes permiso para registrar.</p>
        )}
      </div>
    </div>
  );
}
