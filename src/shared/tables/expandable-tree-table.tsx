"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { InteractiveCell } from "@/shared/tables/interactive-cell";

export type TreeNodeBadge = {
  label: string;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
};

export type TreeNode<T = unknown> = {
  /** Identificador único entre hermanos a TODOS los niveles. */
  id: string;
  /** Etiqueta visible en la columna principal. */
  label: ReactNode;
  /** Datos arbitrarios asociados al nodo (consumidos por `column.render`). */
  data: T;
  /** Hijos pre-cargados. Si está ausente y `loadChildren` resuelve, los reemplaza. */
  children?: TreeNode<T>[];
  /** Forzar tratamiento como hoja (sin chevron, sin expansión). Default: hijos ausentes ⇒ hoja. */
  isLeaf?: boolean;
  /** Si true, la fila tiene affordance link/badge (usa InteractiveCell). */
  isNavigable?: boolean;
  /** Acción al activar la fila navegable. */
  onNavigate?: () => void;
  /** Variante visual del trigger cuando `isNavigable` (default: `link`). */
  navigateVariant?: "link" | "badge" | "underline-text";
  /** Estado seleccionado para variant="badge". */
  isSelected?: boolean;
  /** Badge auxiliar al lado de la etiqueta (e.g. "5 sub", "Cerrado"). */
  badge?: TreeNodeBadge;
};

export type ExpandableTreeTableColumn<T> = {
  key: string;
  label: ReactNode;
  align?: "left" | "right" | "center";
  /** Render del valor para un nodo. Recibe nivel (0-indexed) para variantes de presentación. */
  render: (node: TreeNode<T>, level: number) => ReactNode;
  /** Clase tailwind opcional para la celda. */
  cellClassName?: string;
  /** Clase tailwind opcional para la cabecera. */
  headerClassName?: string;
  /** Si presente, columna sólo se muestra si la condición se cumple para el nodo. */
  visibleAt?: (level: number) => boolean;
};

export type ExpandableTreeTableProps<T> = {
  nodes: TreeNode<T>[];
  columns: ExpandableTreeTableColumn<T>[];
  /** Nivel inicial expandido. -1 para colapsar todo (default: 0 = primer nivel). */
  defaultExpandLevel?: number;
  /** Set controlado de IDs expandidos (opcional). */
  expandedKeys?: Set<string>;
  /** Callback cuando cambia el set expandido. */
  onExpandedChange?: (next: Set<string>) => void;
  /**
   * Lazy load: si el nodo no tiene `children` pre-cargados, esta función
   * se llama al expandir. Debe retornar los hijos del nodo.
   */
  loadChildren?: (node: TreeNode<T>) => Promise<TreeNode<T>[]>;
  /** Estado vacío cuando `nodes.length === 0`. */
  emptyState?: ReactNode;
  /** Indentación en pixels por nivel (default: 16). */
  indentPerLevel?: number;
  /** Clases tailwind para `<table>`. */
  tableClassName?: string;
  /** Si la tabla debe envolverse internamente (default: true) en un wrapper sticky-header friendly. */
  withWrapper?: boolean;
  className?: string;
};

function buildInitialExpandedKeys<T>(nodes: TreeNode<T>[], untilLevel: number, level = 0): Set<string> {
  const set = new Set<string>();
  if (level > untilLevel) return set;
  for (const node of nodes) {
    if (!node.isLeaf && node.children && node.children.length > 0) {
      set.add(node.id);
      const childKeys = buildInitialExpandedKeys(node.children, untilLevel, level + 1);
      childKeys.forEach((k) => set.add(k));
    }
  }
  return set;
}

/**
 * Tabla canónica jerárquica para visualizaciones árbol/desplegables.
 *
 * Soporta:
 * - Niveles arbitrarios (área → ciclo → actividad → persona → detalle)
 * - Indentación progresiva por nivel
 * - Chevron canónico a la izquierda con animación implicita
 * - Subtotales en filas de grupo (vía `column.render`)
 * - Lazy loading vía `loadChildren`
 * - Filas hoja navegables (abren ficha) usando `InteractiveCell`
 * - Badges no-interactivos vía `node.badge`
 *
 * NO usar para tablas planas; usar `<ScrollFadeTable>` + `<StandardTable>` directamente.
 *
 * @example
 * <ExpandableTreeTable
 *   nodes={costAreas}
 *   columns={[
 *     { key: "label", label: "Descripción", render: (node) => node.label },
 *     { key: "hours", label: "Horas", align: "right", render: (n) => formatHours(n.data.totalHours) },
 *   ]}
 *   defaultExpandLevel={0}
 * />
 */
export function ExpandableTreeTable<T>({
  nodes,
  columns,
  defaultExpandLevel = 0,
  expandedKeys,
  onExpandedChange,
  loadChildren,
  emptyState,
  indentPerLevel = 16,
  tableClassName,
  withWrapper = true,
  className,
}: ExpandableTreeTableProps<T>) {
  const isControlled = expandedKeys !== undefined;
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() =>
    isControlled ? new Set(expandedKeys) : buildInitialExpandedKeys(nodes, defaultExpandLevel),
  );
  const [loadedChildrenMap, setLoadedChildrenMap] = useState<Map<string, TreeNode<T>[]>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  const expanded = isControlled ? expandedKeys : internalExpanded;

  useEffect(() => {
    if (isControlled) return;
    // Si nodes cambia sustancialmente, re-establecer la expansión inicial.
    setInternalExpanded(buildInitialExpandedKeys(nodes, defaultExpandLevel));
  }, [nodes, defaultExpandLevel, isControlled]);

  const setExpanded = useCallback(
    (next: Set<string>) => {
      if (isControlled) onExpandedChange?.(next);
      else {
        setInternalExpanded(next);
        onExpandedChange?.(next);
      }
    },
    [isControlled, onExpandedChange],
  );

  const handleToggle = useCallback(
    async (node: TreeNode<T>) => {
      const isExpanded = expanded?.has(node.id) ?? false;
      const next = new Set(expanded ?? []);
      if (isExpanded) {
        next.delete(node.id);
        setExpanded(next);
        return;
      }
      next.add(node.id);
      setExpanded(next);

      const hasPreloadedChildren = (node.children?.length ?? 0) > 0;
      const hasLoadedChildren = loadedChildrenMap.has(node.id);
      if (!hasPreloadedChildren && !hasLoadedChildren && loadChildren && !inFlightRef.current.has(node.id)) {
        inFlightRef.current.add(node.id);
        setLoadingIds((prev) => new Set(prev).add(node.id));
        try {
          const children = await loadChildren(node);
          setLoadedChildrenMap((prev) => {
            const map = new Map(prev);
            map.set(node.id, children);
            return map;
          });
        } finally {
          inFlightRef.current.delete(node.id);
          setLoadingIds((prev) => {
            const set = new Set(prev);
            set.delete(node.id);
            return set;
          });
        }
      }
    },
    [expanded, loadChildren, loadedChildrenMap, setExpanded],
  );

  const visibleColumns = columns;

  if (nodes.length === 0) {
    return (
      <div className={cn("py-8 text-center text-sm text-muted-foreground", className)}>
        {emptyState ?? "Sin registros disponibles."}
      </div>
    );
  }

  const renderRow = (node: TreeNode<T>, level: number, parentKey: string): ReactNode => {
    const nodeKey = `${parentKey}/${node.id}`;
    const isExpanded = expanded?.has(node.id) ?? false;
    const childrenSource = node.children ?? loadedChildrenMap.get(node.id);
    const hasChildrenLoaded = (childrenSource?.length ?? 0) > 0;
    const canExpand = !node.isLeaf && (hasChildrenLoaded || (loadChildren !== undefined));
    const isLoading = loadingIds.has(node.id);

    return (
      <Fragment key={nodeKey}>
        <tr
          className={cn(
            "border-b border-border/60 transition-colors",
            level === 0 ? "bg-muted/15" : level === 1 ? "bg-muted/8" : undefined,
            "hover:bg-muted/25",
          )}
        >
          {visibleColumns.map((column, columnIndex) => {
            if (column.visibleAt && !column.visibleAt(level)) {
              return <td key={column.key} className={cn("px-3 py-2", column.cellClassName)} />;
            }
            const isFirstColumn = columnIndex === 0;
            const indentStyle = isFirstColumn ? { paddingLeft: 12 + level * indentPerLevel } : undefined;
            const alignClass = column.align === "right"
              ? "text-right tabular-nums"
              : column.align === "center"
                ? "text-center"
                : "text-left";

            if (isFirstColumn) {
              const labelNode = node.isNavigable ? (
                <InteractiveCell
                  label={node.label}
                  onActivate={node.onNavigate}
                  variant={node.navigateVariant ?? "link"}
                  isSelected={node.isSelected}
                  stopPropagation
                />
              ) : (
                column.render(node, level)
              );
              return (
                <td
                  key={column.key}
                  className={cn("px-3 py-2", alignClass, column.cellClassName)}
                  style={indentStyle}
                >
                  <div className="flex items-center gap-2">
                    {canExpand ? (
                      <button
                        type="button"
                        onClick={() => handleToggle(node)}
                        aria-label={isExpanded ? "Colapsar" : "Expandir"}
                        aria-expanded={isExpanded}
                        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        {isLoading ? (
                          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : isExpanded ? (
                          <ChevronDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-3.5" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <span className="size-5 shrink-0" aria-hidden="true" />
                    )}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="min-w-0 truncate">{labelNode}</span>
                      {node.badge ? (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            node.badge.tone === "info" && "border-chart-info/50 bg-chart-info-soft text-chart-info-bold",
                            node.badge.tone === "success" && "border-chart-success/50 bg-chart-success-soft text-chart-success-bold",
                            node.badge.tone === "warning" && "border-chart-warning/50 bg-chart-warning-soft text-chart-warning",
                            node.badge.tone === "danger" && "border-destructive/50 bg-destructive/10 text-destructive",
                            (!node.badge.tone || node.badge.tone === "neutral") && "border-border/60 bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {node.badge.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </td>
              );
            }

            return (
              <td key={column.key} className={cn("px-3 py-2", alignClass, column.cellClassName)}>
                {column.render(node, level)}
              </td>
            );
          })}
        </tr>
        {isExpanded && childrenSource
          ? childrenSource.map((child) => renderRow(child as TreeNode<T>, level + 1, nodeKey))
          : null}
      </Fragment>
    );
  };

  const tableEl = (
    <table className={cn("w-full border-separate border-spacing-0 text-sm", tableClassName)}>
      <thead className="sticky top-0 z-10 bg-card">
        <tr>
          {visibleColumns.map((column) => (
            <th
              key={column.key}
              className={cn(
                "border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                column.align === "right"
                  ? "text-right"
                  : column.align === "center"
                    ? "text-center"
                    : "text-left",
                column.headerClassName,
              )}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {nodes.map((node) => renderRow(node, 0, "root"))}
      </tbody>
    </table>
  );

  if (!withWrapper) return <div className={className}>{tableEl}</div>;

  return (
    <div className={cn("relative overflow-x-auto rounded-[16px] border border-border/70 bg-card", className)}>
      {tableEl}
    </div>
  );
}
