"use client";

import type React from "react";
import { BriefcaseBusiness, CalendarClock, HeartPulse, UserRound } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { fetchJson } from "@/lib/fetch-json";
import type { CollaboratorDetailPayload } from "@/lib/talento-humano-colaboradores";
import { AbsenceSummaryCard, AbsenteeismSection, PerformanceSection, PerformanceTrendCard } from "@/modules/talento-humano/components/colaboradores-analytics-sections";
import { EmptyState } from "@/shared/data-display/empty-state";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { KpiGrid } from "@/shared/layout/filter-panel";
import { formatDate, formatFlexibleNumber, formatInteger, formatPercent } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export type CollaboratorTabKey = "basic" | "performance" | "medical" | "absenteeism" | "exits" | "followups";

type MedicalPayload = {
  summary: { examsCount: number; lastExamDate: string | null; lastExamType: string | null; availableMarkerCount: number; alertExamCount: number };
  exams: Array<{ examId: number; date: string; type: string; alertsCount: number; markers: Array<{ field: string; name: string; value: number | null; unit: string; status: string; range: string }> }>;
};

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function val(value: string | number | null | undefined) {
  if (value == null || String(value).trim() === "") return "-";
  return String(value);
}

function dateVal(value: string | null | undefined) {
  return value ? formatDate(value) : "-";
}

function pct(value: number | null | undefined) {
  return value == null ? "-" : formatPercent(value, { input: "ratio" });
}

function boolVal(value: boolean | null | undefined) {
  if (value == null) return "-";
  return value ? "Sí" : "No";
}

export function HeaderCard({ detail }: { detail: CollaboratorDetailPayload }) {
  const profile = detail.profile;

  return (
    <Card className="starter-panel border-border/70 bg-card/84">
      <CardContent className="p-5">
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-slate-900 to-emerald-600 text-2xl font-semibold text-white">
            {initials(profile.personName)}
          </div>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{profile.personName}</h2>
                <p className="text-sm text-muted-foreground">ID {profile.personId} · {profile.nationalId ?? "sin cédula"}</p>
              </div>
              <Badge variant={profile.isActive ? "success" : "danger"}>{profile.isActive ? "Activo" : "Pasivo"}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniField label="Cargo" value={profile.jobTitle} />
              <MiniField label="Área actual" value={profile.areaName ?? profile.areaId} />
              <MiniField label="Clasificación" value={profile.jobClassificationCode} />
              <MiniField label="T. social" value={profile.associatedWorkerName} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TabContent({ tab, detail }: { tab: CollaboratorTabKey; detail: CollaboratorDetailPayload }) {
  if (tab === "basic") return <BasicSection detail={detail} />;
  if (tab === "performance") return detail.performance ? <PerformanceSection data={detail.performance} /> : <EmptyState label="Sin permiso o sin datos de rendimiento." />;
  if (tab === "medical") return <MedicalSection personId={detail.profile.personId} />;
  if (tab === "absenteeism") return detail.absenteeism ? <AbsenteeismSection data={detail.absenteeism} /> : <EmptyState label="Sin permiso o sin datos de ausentismo." />;
  if (tab === "exits") return detail.exits ? <ExitsSection rows={detail.exits} /> : <EmptyState label="Sin permiso o sin datos de salidas." />;
  if (tab === "followups") return detail.followups ? <FollowupsSection rows={detail.followups} /> : <EmptyState label="Sin permiso o sin seguimientos." />;
  return null;
}

function BasicSection({ detail }: { detail: CollaboratorDetailPayload }) {
  const p = detail.profile;
  const areaHistory = detail.areaEvents.filter((event) => event.eventType === "CA");
  const entryHistory = detail.areaEvents.filter((event) => event.eventType === "IS");
  const hasSummaryCharts = Boolean(detail.performance && detail.absenteeism);

  return (
    <div className="space-y-4">
      <KpiGrid className="grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        <MetricTile label="Ingresos" value={formatInteger(p.entryCount)} hint={`Último: ${dateVal(p.lastEntryDate)}`} />
        <MetricTile label="Rendimiento" value={pct(detail.performance?.totals.rendimiento)} hint="ponderado visible" />
        <MetricTile label="Seguimientos" value={detail.followups ? formatInteger(detail.followups.length) : "-"} hint="registros vigentes" />
      </KpiGrid>
      <div className={`grid gap-4 ${hasSummaryCharts ? "xl:grid-cols-[minmax(0,2fr)_minmax(300px,.8fr)]" : "xl:grid-cols-1"}`}>
        {detail.performance ? <PerformanceTrendCard data={detail.performance} /> : null}
        {detail.absenteeism ? <AbsenceSummaryCard absenteeism={detail.absenteeism} /> : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <InfoCard title="Datos personales" icon={<UserRound className="size-4" />}>
          <MiniField label="Género" value={p.gender} />
          <MiniField label="Estado civil" value={p.maritalStatus} />
          <MiniField label="Nacimiento" value={dateVal(p.birthDate)} />
          <MiniField label="Nacionalidad" value={p.nationality} />
          <MiniField label="Educación" value={p.educationTitle} />
          <MiniField label="Discapacidad" value={boolVal(p.disabledFlag)} />
        </InfoCard>
        <InfoCard title="Datos laborales" icon={<BriefcaseBusiness className="size-4" />}>
          <MiniField label="Empresa" value={p.employerName} />
          <MiniField label="Tipo empleado" value={p.employeeType} />
          <MiniField label="Contrato" value={p.contractType} />
          <MiniField label="Pago rendimiento" value={boolVal(p.performancePayApplicable)} />
          <MiniField label="Última entrada" value={dateVal(p.lastEntryDate)} />
          <MiniField label="Última salida" value={dateVal(p.lastExitDate)} />
        </InfoCard>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <HistoryCard title="Historial de área" headers={["Área", "Desde", "Hasta", "Actual"]}>
          {areaHistory.slice(0, 12).map((event, index) => (
            <tr key={`${event.validFrom}-${index}`} className="border-t border-border/40">
              <td className="px-3 py-2">{event.areaName ?? event.areaId ?? "-"}</td>
              <td className="px-3 py-2">{dateVal(event.validFrom)}</td>
              <td className="px-3 py-2">{dateVal(event.validTo)}</td>
              <td className="px-3 py-2">{event.isCurrent ? "Sí" : "No"}</td>
            </tr>
          ))}
        </HistoryCard>
        <HistoryCard title="Ingresos y salidas" headers={["Desde", "Hasta", "Actual"]}>
          {entryHistory.slice(0, 12).map((event, index) => (
            <tr key={`${event.validFrom}-${index}`} className="border-t border-border/40">
              <td className="px-3 py-2">{dateVal(event.validFrom)}</td>
              <td className="px-3 py-2">{dateVal(event.validTo)}</td>
              <td className="px-3 py-2">{event.isCurrent ? "Sí" : "No"}</td>
            </tr>
          ))}
        </HistoryCard>
      </div>
    </div>
  );
}

function MedicalSection({ personId }: { personId: string }) {
  const { data, error, isLoading } = useSWRImmutable(`/api/medical/person/${encodeURIComponent(personId)}`, (url) =>
    fetchJson<MedicalPayload>(url, "No se pudo cargar la ficha médica."),
  );
  const latest = data?.exams[0] ?? null;
  if (isLoading) return <EmptyState label="Cargando ficha médica." />;
  if (error) return <EmptyState label="No se pudo cargar la ficha médica." />;

  return (
    <div className="space-y-4">
      <KpiGrid className="grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        <MetricTile label="Exámenes" value={formatInteger(data?.summary.examsCount ?? 0)} hint={`Último: ${dateVal(data?.summary.lastExamDate)}`} />
        <MetricTile label="Tipo último" value={data?.summary.lastExamType ?? "-"} />
        <MetricTile label="Marcadores" value={formatInteger(data?.summary.availableMarkerCount ?? 0)} />
        <MetricTile label="Alertas" value={formatInteger(data?.summary.alertExamCount ?? 0)} />
      </KpiGrid>
      <Card className="border-border/70 bg-card/84">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HeartPulse className="size-4" />Últimos marcadores</CardTitle></CardHeader>
        <CardContent>
          {!latest ? <EmptyState label="Sin exámenes médicos registrados." /> : (
            <SimpleTable headers={["Marcador", "Valor", "Unidad", "Estado", "Rango"]}>
              {latest.markers.slice(0, 12).map((marker) => (
                <tr key={marker.field} className="border-t border-border/40">
                  <td className="px-3 py-2">{marker.name}</td>
                  <td className="px-3 py-2 text-right font-semibold">{marker.value == null ? "-" : formatFlexibleNumber(marker.value)}</td>
                  <td className="px-3 py-2">{marker.unit}</td>
                  <td className="px-3 py-2">{marker.status}</td>
                  <td className="px-3 py-2">{marker.range}</td>
                </tr>
              ))}
            </SimpleTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExitsSection({ rows }: { rows: NonNullable<CollaboratorDetailPayload["exits"]> }) {
  return (
    <Card className="border-border/70 bg-card/84">
      <CardHeader><CardTitle className="text-base">Historial de salidas</CardTitle></CardHeader>
      <CardContent>
        <SimpleTable headers={["Ingreso", "Salida", "Meses", "Motivo", "Categoría", "Cumpl.", "Observaciones"]} minWidth="1180px">
          {rows.map((row, index) => (
            <tr key={`${row.exitDate}-${index}`} className="border-t border-border/40 align-top">
              <td className="px-3 py-2">{dateVal(row.entryDate)}</td>
              <td className="px-3 py-2">{dateVal(row.exitDate)}</td>
              <td className="px-3 py-2 text-right">{row.activeMonths == null ? "-" : formatFlexibleNumber(row.activeMonths)}</td>
              <td className="px-3 py-2">{row.exitReason ?? "-"}</td>
              <td className="px-3 py-2">{row.resignationCategory ?? "-"}</td>
              <td className="px-3 py-2 text-right font-semibold">{pct(row.cumplimiento)}</td>
              <td className="max-w-[420px] whitespace-normal break-words px-3 py-2 leading-relaxed">{row.observations ?? "-"}</td>
            </tr>
          ))}
        </SimpleTable>
      </CardContent>
    </Card>
  );
}

function FollowupsSection({ rows }: { rows: NonNullable<CollaboratorDetailPayload["followups"]> }) {
  return (
    <div className="space-y-3">
      {rows.length === 0 ? <EmptyState label="Sin seguimientos registrados." /> : null}
      {rows.map((followup) => (
        <Card key={followup.eventId} className="border-border/70 bg-card/84">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{dateVal(followup.followUpDate)}</Badge>
              <Badge variant="secondary">{followup.followupRouteCode}</Badge>
              <Badge variant="outline">v{followup.responseVersion}</Badge>
            </div>
            <CardTitle className="text-base">Seguimiento {followup.followUpCode}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {followup.sections.map((section) => (
              <div key={section.title} className="rounded-[18px] border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-semibold">{section.title}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {section.items.map((item) => <MiniField key={`${section.title}-${item.label}`} label={item.label} value={item.value} />)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="border-border/70 bg-card/84">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function HistoryCard({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <Card className="border-border/70 bg-card/84">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4" />{title}</CardTitle></CardHeader>
      <CardContent><SimpleTable headers={headers}>{children}</SimpleTable></CardContent>
    </Card>
  );
}

function MiniField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-[16px] border border-border/60 bg-background/70 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{val(value)}</p>
    </div>
  );
}

function SimpleTable({ headers, children, minWidth = "760px" }: { headers: string[]; children: React.ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-auto rounded-[18px] border border-border/60 bg-background/70">
      <table className="w-full text-xs" style={{ minWidth }}>
        <thead className="sticky top-0 z-10 bg-muted/70 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-2 text-left font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
