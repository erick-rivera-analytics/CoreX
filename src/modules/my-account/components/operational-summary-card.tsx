import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { KpiGrid } from "@/shared/layout/filter-panel";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { formatInteger } from "@/shared/lib/format";
import type { MyAccountWorkSummary } from "@/modules/my-account/index";

export function OperationalSummaryCard({ summary }: { summary: MyAccountWorkSummary }) {
  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Resumen operativo</CardTitle>
      </CardHeader>
      <CardContent>
        <KpiGrid columns={2}>
          <MetricTile label="Pendientes hoy" value={formatInteger(summary.pendingToday)} />
          <MetricTile
            label="Vencidas"
            value={formatInteger(summary.overdue)}
            accent={summary.overdue > 0 ? "danger" : "default"}
          />
          <MetricTile label="Prox. recordatorios" value={formatInteger(summary.upcomingReminders)} />
          <MetricTile label="Siguiente evento" value={summary.nextEventLabel} />
        </KpiGrid>
      </CardContent>
    </Card>
  );
}
