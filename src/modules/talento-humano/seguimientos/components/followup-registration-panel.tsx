"use client";

import { useState } from "react";
import { AlertCircle, Save, UserCheck, X } from "lucide-react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import { decodeMultiSelectValue } from "@/lib/multi-select";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
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

const CATALOG_LABELS: Record<string, string> = {
  treatment_rating: "Trato",
  yes_no: "Sí / No",
  retention_intention: "Permanencia",
  hr_support_need: "Apoyo RRHH",
  family_pregnancy_relation: "Familiar / embarazo",
  inconvenience_activity: "Actividad de novedad",
  inconvenience_type: "Tipo de novedad",
  work_difficulty: "Dificultades",
  work_like_most: "Gustos del trabajo",
  improvement_opportunity: "Oportunidades",
  short_retention_reason: "Razón de salida corta",
  adaptation_response: "Adaptación",
  satisfaction_level: "Satisfacción",
  work_aspect_to_improve: "Aspectos a mejorar",
};

const AGR_REQUIRED_CATALOGS = [
  "treatment_rating",
  "yes_no",
  "retention_intention",
  "hr_support_need",
  "family_pregnancy_relation",
  "inconvenience_activity",
  "inconvenience_type",
  "work_difficulty",
  "work_like_most",
  "improvement_opportunity",
  "short_retention_reason",
];

const ADM_REQUIRED_CATALOGS = [
  "yes_no",
  "adaptation_response",
  "satisfaction_level",
  "retention_intention",
  "work_aspect_to_improve",
];

const EMPTY_AGR: AgrFormState = {
  workDiffEncoded: "", workDiffOther: "", workDifficultyObs: "",
  coworkerRating: "", supervisorRating: "", areaManagerRating: "",
  conflictPersonId: "", conflictDetail: "",
  workLikeMostEncoded: "", workLikeMostOther: "", workLikeMostObs: "",
  improvOppEncoded: "", improvOppOther: "", improvementOppObs: "", agrSatisfactionObs: "",
  retentionIntention: "", retentionReasonObs: "", shortRetentionEncoded: "", shortRetentionOther: "",
  hrSupportNeed: "", hrSupportOther: "",
  familyPregnancyRelation: "", familyPregnancyObs: "",
  hasInconvenience: "", inconvenienceDate: "",
  inconvenienceActivity: "", inconvenienceActivityOther: "",
  inconvenienceType: "", inconvenienceTypeOther: "",
};

const EMPTY_ADM: AdmFormState = {
  inductionSufficient: "", transportProblem: "", teamWelcome: "",
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
  const requiredCatalogs = route === "AGR" ? AGR_REQUIRED_CATALOGS : ADM_REQUIRED_CATALOGS;
  const missingCatalogs = requiredCatalogs.filter((catalogCode) => !catalogs[catalogCode]?.length);
  const catalogsReady = missingCatalogs.length === 0;
  const scheduledFrequencyCode = followup.followUpType ?? null;
  const agrFrequencyCode = scheduledFrequencyCode && catOpts("agr_followup_frequency").includes(scheduledFrequencyCode)
    ? scheduledFrequencyCode
    : null;
  const admFrequencyCode = scheduledFrequencyCode && catOpts("adm_followup_frequency").includes(scheduledFrequencyCode)
    ? scheduledFrequencyCode
    : null;

  async function handleSubmit() {
    if (!permissions.canWrite) { toast.error("No tienes permiso para registrar seguimientos."); return; }
    if (!catalogsReady) {
      toast.error("Faltan catálogos del formulario. Recarga el módulo o valida db_human_talent.");
      return;
    }

    const agr = agrState;
    const adm = admState;

    const selections: Array<{ selectionGroupCode: string; catalogCode: string; itemCode: string; otherDetail?: string | null; displayOrder?: number }> = [];
    const addSelections = (encoded: string, groupCode: string, catalogCode: string, otherDetail: string) => {
      decodeMultiSelectValue(encoded).forEach((itemCode, displayOrder) => {
        selections.push({
          selectionGroupCode: groupCode,
          catalogCode,
          itemCode,
          otherDetail: itemCode === "other" ? otherDetail || null : null,
          displayOrder,
        });
      });
    };
    addSelections(agr.workDiffEncoded, "work_difficulty", "work_difficulty", agr.workDiffOther);
    addSelections(agr.workLikeMostEncoded, "work_like_most", "work_like_most", agr.workLikeMostOther);
    addSelections(agr.improvOppEncoded, "improvement_opportunity", "improvement_opportunity", agr.improvOppOther);
    addSelections(agr.shortRetentionEncoded, "short_retention_reason", "short_retention_reason", agr.shortRetentionOther);

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
        agrFollowupFrequencyCode: agrFrequencyCode,
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
        admFollowupFrequencyCode: admFrequencyCode,
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

  function catOpts(k: string) {
    return toOpts(catalogs[k]);
  }

  function catDV(k: string) {
    return buildDV(catalogs[k]);
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
                <Badge variant={followup.status === "registered" ? "success" : "outline"}>
                  {followup.status === "pending" ? "Pendiente" : "Registrado"}
                </Badge>
                {scheduledFrequencyCode ? <Badge variant="secondary">Frecuencia {scheduledFrequencyCode}</Badge> : null}
              </div>
              <div>
                <CardTitle className="text-lg">{followup.personName}</CardTitle>
                <CardDescription>
                  Seguimiento {followup.followUpDate}
                  {followup.associatedWorkerName ? ` · ${followup.associatedWorkerName}` : ""}
                </CardDescription>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar seguimiento">
            <X className="size-4" />
          </Button>
        </div>

        {!catalogsReady ? (
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Faltan opciones del formulario.</p>
                <p className="mt-1 text-xs">
                  Catálogos sin ítems: {missingCatalogs.map((catalogCode) => CATALOG_LABELS[catalogCode] ?? catalogCode).join(", ")}.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        <div className="max-h-[calc(100dvh-14rem)] space-y-6 overflow-y-auto pr-1">
        <PersonQuickCard personId={followup.personId} asOfDate={asOfDate} />

        {route === "AGR" && (
          <FollowupFormAgr
            state={agrState} setField={setAgrField}
            asOfDate={asOfDate}
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
          <Button className="w-full rounded-full" onClick={handleSubmit} disabled={submitting || !catalogsReady}>
            <Save className={cn("size-4", submitting && "animate-pulse")} />
            {submitting ? "Guardando..." : "Registrar seguimiento"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground text-center">Solo lectura. No tienes permiso para registrar.</p>
        )}
      </div>
      </CardContent>
    </Card>
  );
}
