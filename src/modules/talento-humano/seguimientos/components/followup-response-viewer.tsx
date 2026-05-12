"use client";

import type React from "react";
import { Eye, X } from "lucide-react";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import { computeTenureDays, formatTenureLabel } from "@/lib/talento-humano-colaboradores-utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type {
  EmployeeFollowupCatalogMap,
  EmployeeFollowupResponseDetail,
  EmployeeScheduledFollowupRow,
} from "@/modules/talento-humano/seguimientos/server/types";

type Props = {
  followup: EmployeeScheduledFollowupRow;
  catalogs: EmployeeFollowupCatalogMap;
  onClose: () => void;
};

const detailFetcher = (url: string) =>
  fetchJson<EmployeeFollowupResponseDetail>(url, "No se pudo cargar el seguimiento registrado.");

function buildCatalogLookup(catalogs: EmployeeFollowupCatalogMap) {
  const lookup = new Map<string, string>();
  for (const [catalogCode, items] of Object.entries(catalogs)) {
    for (const item of items) {
      lookup.set(`${catalogCode}::${item.itemCode}`, item.itemLabelEs);
    }
  }
  return lookup;
}

function ValueRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-[16px] border border-border/70 bg-background/70 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function ResponseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function FollowupResponseViewer({ followup, catalogs, onClose }: Props) {
  const eventId = followup.responseEventId;
  const { data, isLoading } = useSWR(
    eventId ? `/api/talento-humano/seguimientos/responses/${encodeURIComponent(eventId)}` : null,
    detailFetcher,
    { revalidateOnFocus: false },
  );
  const lookup = buildCatalogLookup(catalogs);
  const label = (catalogCode: string, value: string | null | undefined) =>
    value ? lookup.get(`${catalogCode}::${value}`) ?? value : null;
  const selections = (groupCode: string, catalogCode: string) => {
    return (data?.selections ?? []).reduce<string[]>((acc, selection) => {
      if (selection.selectionGroupCode === groupCode) {
        const base = label(catalogCode, selection.itemCode) ?? selection.itemCode;
        acc.push(selection.otherDetail ? `${base}: ${selection.otherDetail}` : base);
      }
      return acc;
    }, []).join(", ");
  };

  return (
    <Card className="starter-panel border-border/70 bg-card/84">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
              <Eye className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Registrado</Badge>
                <Badge variant="outline">Clasificacion {followup.derivedRoute}</Badge>
                {data?.responseVersion ? <Badge variant="secondary">Version {data.responseVersion}</Badge> : null}
                {(() => {
                  const tenure = formatTenureLabel(computeTenureDays(followup.lastEntryDate));
                  return tenure ? <Badge variant="outline">Antigüedad: {tenure}</Badge> : null;
                })()}
              </div>
              <div>
                <CardTitle className="text-lg">{followup.personName}</CardTitle>
                <CardDescription>
                  Respuesta del seguimiento {followup.followUpDate}
                  {(() => {
                    const days = computeTenureDays(followup.lastEntryDate);
                    return days !== null ? ` · ${days} día${days === 1 ? "" : "s"} en la empresa` : "";
                  })()}
                  {data?.actorId ? ` · Registrado por ${data.actorId}` : ""}
                </CardDescription>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar detalle">
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="max-h-[calc(100dvh-14rem)] space-y-6 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="rounded-[20px] border border-border/70 bg-background/70 px-4 py-8 text-center text-sm text-muted-foreground">
              Cargando respuestas…
            </div>
          ) : null}

          {!isLoading && !data ? (
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              No se encontro el detalle registrado para este seguimiento.
            </div>
          ) : null}

          {data?.followupRouteCode === "AGR" ? (
            <>
              <ResponseSection title="Dificultades laborales">
                <ValueRow label="Dificultades" value={selections("work_difficulty", "work_difficulty")} />
                <ValueRow label="Observacion" value={data.workDifficultyObservation} />
              </ResponseSection>
              <ResponseSection title="Relaciones laborales">
                <ValueRow label="Trato compañeros" value={label("treatment_rating", data.coworkerTreatmentRatingCode)} />
                <ValueRow label="Trato supervisor" value={label("treatment_rating", data.supervisorTreatmentRatingCode)} />
                <ValueRow label="Trato jefe area" value={label("treatment_rating", data.areaManagerTreatmentRatingCode)} />
                <ValueRow label="Persona conflicto" value={data.conflictPersonId} />
                <ValueRow label="Detalle conflicto" value={data.conflictSituationDetail} />
              </ResponseSection>
              <ResponseSection title="Satisfaccion y permanencia">
                <ValueRow label="Le gusta" value={selections("work_like_most", "work_like_most")} />
                <ValueRow label="Oportunidades" value={selections("improvement_opportunity", "improvement_opportunity")} />
                <ValueRow label="Permanencia" value={label("retention_intention", data.retentionIntentionCode)} />
                <ValueRow label="Razon salida corta" value={selections("short_retention_reason", "short_retention_reason")} />
              </ResponseSection>
              <ResponseSection title="Talento humano y novedades">
                <ValueRow label="Apoyo requerido" value={label("hr_support_need", data.hrSupportNeedCode)} />
                <ValueRow label="Familiar embarazo" value={label("family_pregnancy_relation", data.familyPregnancyRelationCode)} />
                <ValueRow label="Hubo novedad" value={label("yes_no", data.hasInconvenienceCode)} />
                <ValueRow label="Actividad" value={label("inconvenience_activity", data.inconvenienceActivityCode)} />
                <ValueRow label="Tipo novedad" value={label("inconvenience_type", data.inconvenienceTypeCode)} />
              </ResponseSection>
            </>
          ) : null}

          {data?.followupRouteCode === "ADM" ? (
            <>
              <ResponseSection title="Adaptacion inicial">
                <ValueRow label="Induccion suficiente" value={label("adaptation_response", data.inductionSufficientCode)} />
                <ValueRow label="Transporte" value={label("adaptation_response", data.transportProblemCode)} />
                <ValueRow label="Bienvenida equipo" value={label("adaptation_response", data.teamWelcomeCode)} />
                <ValueRow label="Observacion negativa" value={data.adaptationNegativeObservation} />
                <ValueRow label="Sugerencia" value={data.adaptationSuggestion} />
              </ResponseSection>
              <ResponseSection title="Satisfaccion">
                <ValueRow label="Claridad funciones" value={label("satisfaction_level", data.roleClaritySatisfactionCode)} />
                <ValueRow label="Ambiente" value={label("satisfaction_level", data.workEnvironmentSatisfactionCode)} />
                <ValueRow label="Equipos" value={label("satisfaction_level", data.equipmentSatisfactionCode)} />
                <ValueRow label="Satisfaccion reciente" value={label("satisfaction_level", data.recentWorkSatisfactionCode)} />
              </ResponseSection>
              <ResponseSection title="Mejora y permanencia">
                <ValueRow label="Aspecto a mejorar" value={label("work_aspect_to_improve", data.workAspectToImproveCode)} />
                <ValueRow label="Detalle disgusto" value={data.dissatisfactionDetail} />
                <ValueRow label="Permanencia final" value={label("retention_intention", data.finalRetentionIntentionCode)} />
                <ValueRow label="Sugerencia final" value={data.finalStaySuggestion} />
              </ResponseSection>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
