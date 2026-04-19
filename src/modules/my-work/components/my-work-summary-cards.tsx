import { MetricTile } from "@/shared/data-display/metric-tile";
import { KpiGrid } from "@/shared/layout/filter-panel";
import { formatInteger } from "@/shared/lib/format";
import type { MyWorkSummary } from "@/modules/my-work/server/types";

export function MyWorkSummaryCards({ summary }: { summary: MyWorkSummary }) {
  return (
    <KpiGrid columns={5}>
      <MetricTile label="Pendientes hoy" value={formatInteger(summary.pendingToday)} />
      <MetricTile label="Vencidas" value={formatInteger(summary.overdue)} accent={summary.overdue ? "warning" : "default"} />
      <MetricTile label="En progreso" value={formatInteger(summary.inProgress)} />
      <MetricTile label="Agenda 7 dias" value={formatInteger(summary.nextSevenDays)} />
      <MetricTile label="Siguiente evento" value={summary.nextEventLabel} hint={`${formatInteger(summary.upcomingReminders)} recordatorios proximos`} />
    </KpiGrid>
  );
}
