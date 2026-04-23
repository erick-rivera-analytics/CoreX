"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Expand,
  Layers3,
  Link2,
  Table as TableIcon,
  X,
} from "lucide-react";

import type { BalanzasNodeData, BalanzasNodeKey, BalanzasTableColumn } from "@/lib/postcosecha-balanzas";
import {
  resolveAggregateChildren,
  type BalanzasProcessSelection,
} from "@/modules/postcosecha/lib/balanzas-process-stages";
import { formatDisplayValue } from "@/modules/postcosecha/lib/balanzas-node-format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { KpiGrid } from "@/shared/layout/filter-panel";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { ScrollFadeTable } from "@/shared/tables/scroll-fade-table";
import { formatDate, formatInteger } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

type PanelTab = "resumen" | "desglose" | "metadatos";

const PANEL_TABS: Array<{ id: PanelTab; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "desglose", label: "Desglose" },
  { id: "metadatos", label: "Metadatos" },
];

const PREVIEW_ROW_COUNT = 10;

function buildConnectionRows(node: BalanzasNodeData) {
  return [
    { label: "Ruta", value: node.laneLabel },
    { label: "Foco", value: node.focusStage },
    { label: "Contexto", value: `${node.sourceStage} -> ${node.targetStage}` },
    {
      label: "Binding",
      value: node.processBindings.length
        ? `${node.processBindings.length} elemento(s)`
        : "Sin binding",
    },
  ];
}

function pickPreviewColumns(node: BalanzasNodeData): BalanzasTableColumn[] {
  const destinationKey = node.columnMap.destination;
  const dateKey = node.columnMap.date;
  const sourceKey = node.columnMap.source;
  const targetKey = node.columnMap.target;
  const ratioKey = node.columnMap.ratio;

  // Si tenemos métricas clave detectadas, usar el orden preferido
  const hasKeyMetrics = Boolean(sourceKey && targetKey);
  const preferredKeys = hasKeyMetrics
    ? [dateKey, sourceKey, targetKey, ratioKey].filter((v): v is string => Boolean(v))
    : [dateKey, ratioKey].filter((v): v is string => Boolean(v));

  const byKey = new Map(node.tableColumns.map((column) => [column.key, column]));
  const preferred: BalanzasTableColumn[] = [];
  for (const key of preferredKeys) {
    const column = byKey.get(key);
    if (column && column.key !== destinationKey) {
      preferred.push(column);
    }
  }

  // Columnas restantes: priorizar numéricas cuando no hay métricas clave
  const remaining = node.tableColumns.filter(
    (column) => column.key !== destinationKey && !preferred.some((entry) => entry.key === column.key),
  );

  if (!hasKeyMetrics) {
    // Mostrar hasta 6 columnas: preferimos las de tipo número primero
    const numericFirst = [
      ...remaining.filter((c) => c.kind === "number" || c.kind === "ratio"),
      ...remaining.filter((c) => c.kind !== "number" && c.kind !== "ratio"),
    ];
    return [...preferred, ...numericFirst].slice(0, 6);
  }

  return [...preferred, ...remaining].slice(0, 4);
}

function sortRowsForPreview(node: BalanzasNodeData) {
  const dateKey = node.columnMap.date;
  const rows = [...node.rows];

  if (dateKey) {
    rows.sort((a, b) => {
      const aValue = String(a.values[dateKey] ?? "");
      const bValue = String(b.values[dateKey] ?? "");
      return bValue.localeCompare(aValue);
    });
  }

  return rows.slice(0, PREVIEW_ROW_COUNT);
}

export function BalanzasProcessNodePanel({
  node,
  nodes,
  selection,
  metricLabel,
  onExpand,
  onSelectNode,
  onClose,
  widthClassName = "w-[440px]",
}: {
  node: BalanzasNodeData | null;
  nodes: BalanzasNodeData[];
  selection: BalanzasProcessSelection | null;
  metricLabel: string;
  onExpand: () => void;
  onSelectNode: (nodeKey: BalanzasNodeKey) => void;
  onClose: () => void;
  widthClassName?: string;
}) {
  const [activeTab, setActiveTab] = useState<PanelTab>("resumen");
  const aggregateChildren = resolveAggregateChildren(node, nodes);
  const connectionRows = node ? buildConnectionRows(node) : [];
  const previewColumns = useMemo(() => (node ? pickPreviewColumns(node) : []), [node]);
  const previewRows = useMemo(() => (node ? sortRowsForPreview(node) : []), [node]);
  const hiddenRowCount = node ? Math.max(0, node.rowCount - previewRows.length) : 0;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-l border-border/60 bg-card/94 transition-all duration-200",
        node
          ? `${widthClassName} translate-x-0 opacity-100`
          : "pointer-events-none w-0 translate-x-4 opacity-0",
      )}
    >
      {node ? (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold">{node.label}</h3>
                <Badge variant="outline" className="rounded-full px-2 text-[10px]">
                  {node.kind === "aggregate" ? "GENERAL" : "CHART"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{node.laneLabel}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-full"
              onClick={onClose}
              aria-label="Cerrar panel"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div
            className="flex gap-1 border-b border-border/60 px-3 pt-3"
            role="tablist"
            aria-label="Secciones del nodo"
          >
            {PANEL_TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    "rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="show-scrollbar flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {activeTab === "resumen" ? (
              <ResumenTab
                node={node}
                metricLabel={metricLabel}
                aggregateChildren={aggregateChildren}
                selection={selection}
                onSelectNode={onSelectNode}
              />
            ) : null}

            {activeTab === "desglose" ? (
              <DesgloseTab
                node={node}
                previewColumns={previewColumns}
                previewRows={previewRows}
                hiddenRowCount={hiddenRowCount}
              />
            ) : null}

            {activeTab === "metadatos" ? (
              <MetadatosTab node={node} connectionRows={connectionRows} />
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-t border-border/60 p-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl"
              onClick={onExpand}
            >
              <Expand className="size-4" />
              Expandir detalle
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ResumenTab({
  node,
  metricLabel,
  aggregateChildren,
  selection,
  onSelectNode,
}: {
  node: BalanzasNodeData;
  metricLabel: string;
  aggregateChildren: BalanzasNodeData[];
  selection: BalanzasProcessSelection | null;
  onSelectNode: (nodeKey: BalanzasNodeKey) => void;
}) {
  return (
    <>
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
          Resumen rapido
        </p>
        <KpiGrid columns={2}>
          <MetricTile label={node.focusStage} value={node.primaryTotalDisplay} />
          <MetricTile label="Macro" value={node.ratioDisplay} accent="success" />
          <MetricTile label={metricLabel} value={`${formatInteger(node.rowCount)} filas`} />
          <MetricTile label="Ultimo corte" value={formatDate(node.latestDate)} />
        </KpiGrid>
      </section>

      {aggregateChildren.length ? (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
            Nodos de la rama
          </p>
          <div className="space-y-2">
            {aggregateChildren.map((child) => (
              <button
                key={child.key}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                  selection?.nodeKey === child.key
                    ? "border-primary/40 bg-primary/8"
                    : "border-border/70 bg-background/72 hover:bg-muted/45",
                )}
                onClick={() => onSelectNode(child.key)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{child.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {child.fixedDestination ?? child.laneLabel}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{child.primaryTotalDisplay}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{child.ratioDisplay}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function DesgloseTab({
  node,
  previewColumns,
  previewRows,
  hiddenRowCount,
}: {
  node: BalanzasNodeData;
  previewColumns: BalanzasTableColumn[];
  previewRows: BalanzasNodeData["rows"];
  hiddenRowCount: number;
}) {
  if (!previewColumns.length) {
    return (
      <p className="text-xs italic text-muted-foreground/60">
        Este nodo no tiene columnas visibles para mostrar.
      </p>
    );
  }

  if (!previewRows.length) {
    return (
      <p className="text-xs italic text-muted-foreground/60">
        {node.statusMessage ?? "No hay filas disponibles con los filtros actuales."}
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
          Top {previewRows.length} filas
        </p>
        <Badge variant="outline" className="rounded-full px-2 text-[10px]">
          {node.rowCount} totales
        </Badge>
      </div>

      <ScrollFadeTable innerClassName="rounded-2xl border border-border/70 bg-background/72">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card/95">
            <tr>
              {previewColumns.map((column) => (
                <th
                  key={column.key}
                  className="border-b border-border/60 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row) => (
              <tr key={row.id} className="odd:bg-background/60">
                {previewColumns.map((column) => (
                  <td
                    key={`${row.id}-${column.key}`}
                    className="border-b border-border/40 px-3 py-2 text-xs text-foreground"
                  >
                    {formatDisplayValue(node, column, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollFadeTable>

      {hiddenRowCount > 0 ? (
        <p className="text-[11px] text-muted-foreground/70">
          +{formatInteger(hiddenRowCount)} filas mas. Abre &quot;Expandir detalle&quot; para verlas todas.
        </p>
      ) : null}
    </section>
  );
}

function MetadatosTab({
  node,
  connectionRows,
}: {
  node: BalanzasNodeData;
  connectionRows: Array<{ label: string; value: string }>;
}) {
  return (
    <>
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
          Conexiones
        </p>
        <div className="space-y-2 rounded-2xl border border-border/70 bg-background/72 p-3">
          {connectionRows.map((entry) => (
            <div key={entry.label} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{entry.label}</span>
              <span className="text-right font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
          Operativo
        </p>
        <div className="space-y-2 rounded-2xl border border-border/70 bg-background/72 p-3 text-sm">
          <div className="flex items-start gap-2">
            {node.kind === "aggregate" ? (
              <Layers3 className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
            ) : (
              <BarChart3 className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
            )}
            <div className="space-y-1">
              <p className="font-medium">
                {node.kind === "aggregate" ? "Agregado de rama" : "Nodo individual"}
              </p>
              <p className="text-muted-foreground">{node.description}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-muted-foreground">Fuente</span>
            <span className="text-right font-medium">{node.sourceView ?? "Sin vista"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Estado</span>
            <span className="text-right font-medium">{node.statusMessage ?? "Operativo"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Filas</span>
            <span className="font-medium">{formatInteger(node.rowCount)}</span>
          </div>
          {node.secondaryStage ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{node.secondaryStage}</span>
              <span className="font-medium">{node.secondaryTotalDisplay}</span>
            </div>
          ) : null}
          <div className="flex items-start gap-2 pt-1">
            <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
            <p className="text-muted-foreground">
              Las cajas blancas del flujo son estructura visual; las azules y GENERAL son los nodos interactivos.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
          Binding BPMN
        </p>
        <ul className="space-y-1 rounded-2xl border border-border/70 bg-background/72 p-3 text-xs">
          {node.processBindings.length
            ? node.processBindings.map((binding) => (
                <li key={binding.elementId ?? binding.taskName} className="flex items-center gap-2">
                  <ArrowRight className="size-3 text-muted-foreground/60" />
                  <span className="font-medium">{binding.taskName}</span>
                  <span className="truncate text-muted-foreground">
                    {binding.elementId ?? "sin elementId"}
                  </span>
                </li>
              ))
            : (
              <li className="flex items-center gap-2 text-muted-foreground/70">
                <TableIcon className="size-3" />
                Sin bindings registrados.
              </li>
            )}
        </ul>
      </section>

      <SchemaAliasesSection node={node} />
    </>
  );
}

/**
 * Sección diagnóstica: muestra qué alias se resolvieron y qué columnas
 * tiene la vista. Útil para detectar drift cuando las vistas fueron modificadas.
 */
function SchemaAliasesSection({ node }: { node: BalanzasNodeData }) {
  const { columnMap, rawColumnNames } = node;
  const hasSourceTarget = Boolean(columnMap.source && columnMap.target);

  const aliasRows: Array<{ label: string; value: string | null }> = [
    { label: "Fecha", value: columnMap.date },
    { label: "Origen (source)", value: columnMap.source },
    { label: "Destino (target)", value: columnMap.target },
    { label: "Ratio", value: columnMap.ratio },
    { label: "Brecha", value: columnMap.gap },
    { label: "Semana ISO", value: columnMap.isoWeek },
    { label: "Semana PRE", value: columnMap.preWeek },
    { label: "Dia", value: columnMap.dayName },
    { label: "Mes", value: columnMap.month },
    { label: "Destino cat.", value: columnMap.destination },
    { label: "Lote", value: columnMap.lot },
    { label: "Grado", value: columnMap.grade },
    { label: "Dias hid.", value: columnMap.hydrationDays },
  ];

  return (
    <>
      {!hasSourceTarget && rawColumnNames.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-3 text-amber-500" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
              Métricas sin detectar
            </p>
          </div>
          <p className="rounded-2xl border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Las columnas <strong>source</strong> y/o <strong>target</strong> no se detectaron
            automáticamente. La vista fue modificada. Ver &quot;Columnas de la vista&quot; abajo
            para identificar qué columnas contienen los valores de balance.
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
          Aliases resueltos
        </p>
        <ul className="space-y-1 rounded-2xl border border-border/70 bg-background/72 p-3 text-xs">
          {aliasRows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="flex items-center gap-1 font-mono font-medium">
                {row.value ? (
                  <>
                    <CheckCircle2 className="size-3 text-green-500" />
                    {row.value}
                  </>
                ) : (
                  <span className="text-muted-foreground/50 italic">null</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {rawColumnNames.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
            Columnas de la vista ({rawColumnNames.length})
          </p>
          <ul className="space-y-0.5 rounded-2xl border border-border/70 bg-background/72 p-3 text-xs">
            {rawColumnNames.map((col) => (
              <li key={col} className="font-mono text-muted-foreground">
                {col}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
