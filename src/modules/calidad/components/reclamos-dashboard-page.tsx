"use client";

import { Activity } from "lucide-react";

import type { QualityClaimDashboardPlanData } from "@/lib/calidad-reclamos-dashboard";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export function ReclamosDashboardPage({
  initialData,
  initialError,
}: {
  initialData: QualityClaimDashboardPlanData;
  initialError?: string | null;
}) {
  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Analítica / Calidad / Reclamos"
        title="Reclamos"
        subtitle="Frente analítico futuro para visualizar alertas, notas de crédito, motivos y estados del proceso a partir del módulo transaccional de Comercial."
        icon={<Activity className="size-5" aria-hidden="true" />}
      >
        <></>
      </SectionPageShell>

      {initialError ? (
        <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
          {initialError}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader>
            <CardTitle className="text-lg">Cortes del visualizador</CardTitle>
            <CardDescription>Qué mostrará Calidad / Reclamos cuando exista el modelo relacional operativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {initialData.visuals.map((item) => (
              <div key={item.key} className="rounded-[20px] border border-border/70 bg-background/80 p-4">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader>
            <CardTitle className="text-lg">Notas del frente analítico</CardTitle>
            <CardDescription>Delimitación entre el visualizador de Calidad y el módulo operativo de Comercial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {initialData.notes.map((note) => (
              <div key={note} className="rounded-[20px] border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
                {note}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
