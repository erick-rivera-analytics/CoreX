"use client";

import { useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import {
  NODE_LAYOUT,
  STROKE_W,
  TASK_LABELS,
  VB_H,
  VB_W,
  Y,
} from "@/modules/postcosecha/components/balanzas-svg-layout";
import {
  DestLabels,
  Edges,
  Notes,
  RouteLabels,
  StaticShapes,
} from "@/modules/postcosecha/components/balanzas-svg-parts";

type BalanzasViewStatus = "ready" | "unavailable";
type BalanzasProcessBinding = { elementId: string };
type BalanzasProcessNodeView = {
  key: string;
  label: string;
  overlayOffsetLeft: number;
  metrics: { label: string; formatted: string }[];
  status: BalanzasViewStatus;
  processBindings: BalanzasProcessBinding[];
};
type Props = {
  nodes: BalanzasProcessNodeView[];
  selectedNodeKey: string | null;
  onNodeSelect: (nodeKey: string) => void;
};

const C = {
  taskFill:   "var(--bal-task-fill)",
  taskStroke: "var(--bal-task-stroke)",
  taskText:   "var(--bal-task-text)",
  genFill:    "var(--bal-general-fill)",
  genStroke:  "var(--bal-general-stroke)",
  genText:    "var(--bal-general-text)",
  flow:       "var(--bal-flow)",
  divider:    "var(--bal-divider)",
  selected:   "var(--bal-selected)",
};

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.12;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

export function BalanzasProcessSvgViewer({ nodes, selectedNodeKey, onNodeSelect }: Props) {
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, moved: false, x: 0, y: 0, left: 0, top: 0 });

  function applyZoom(nextZoom: number, anchor?: { clientX: number; clientY: number }) {
    const boundedZoom = clampZoom(nextZoom);
    const scroller = scrollRef.current;
    if (!scroller || boundedZoom === zoom) {
      setZoom(boundedZoom);
      return;
    }

    const rect = scroller.getBoundingClientRect();
    const anchorX = anchor ? anchor.clientX - rect.left : rect.width / 2;
    const anchorY = anchor ? anchor.clientY - rect.top : rect.height / 2;
    const contentX = scroller.scrollLeft + anchorX;
    const contentY = scroller.scrollTop + anchorY;
    const ratio = boundedZoom / zoom;

    setZoom(boundedZoom);

    requestAnimationFrame(() => {
      scroller.scrollLeft = contentX * ratio - anchorX;
      scroller.scrollTop = contentY * ratio - anchorY;
    });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    applyZoom(zoom + direction * ZOOM_STEP, { clientX: event.clientX, clientY: event.clientY });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;

    const scroller = scrollRef.current;
    if (!scroller) return;

    panRef.current = {
      active: true,
      moved: false,
      x: event.clientX,
      y: event.clientY,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
    };
    setIsPanning(true);
    scroller.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = panRef.current;
    const scroller = scrollRef.current;
    if (!state.active || !scroller) return;

    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      state.moved = true;
    }
    scroller.scrollLeft = state.left - dx;
    scroller.scrollTop = state.top - dy;
  }

  function stopPanning(event: PointerEvent<HTMLDivElement>) {
    const scroller = scrollRef.current;
    panRef.current.active = false;
    setIsPanning(false);
    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }
  }

  function suppressDraggedClick(event: MouseEvent<HTMLDivElement>) {
    if (!panRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    panRef.current.moved = false;
  }

  const elementToNode = useMemo(() => {
    const m = new Map<string, BalanzasProcessNodeView>();
    for (const n of nodes) for (const b of n.processBindings) m.set(b.elementId, n);
    return m;
  }, [nodes]);

  const overlayCountByElement = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of nodes) {
      for (const binding of node.processBindings) {
        counts.set(binding.elementId, (counts.get(binding.elementId) ?? 0) + 1);
      }
    }
    return counts;
  }, [nodes]);

  const renderedW = VB_W * zoom;
  const renderedH = VB_H * zoom;

  return (
    <div className="rounded-[30px] border border-border/70 bg-[linear-gradient(180deg,rgba(254,254,252,0.98),rgba(238,245,242,0.96))] p-3 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] dark:bg-[linear-gradient(180deg,rgba(26,32,40,0.98),rgba(18,23,31,0.98))]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm text-muted-foreground">
          Haz clic en cualquier nodo balanza para ver el detalle completo. Arrastra el mapa para moverte y usa la rueda del mouse para zoom.
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/88 p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => applyZoom(zoom - ZOOM_STEP)}>
              <Minus className="size-4" aria-hidden="true" />
              <span className="sr-only">Reducir zoom</span>
            </Button>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => applyZoom(1)}>
              <Maximize2 className="size-4" aria-hidden="true" />
              <span className="sr-only">Ajustar</span>
            </Button>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => applyZoom(zoom + ZOOM_STEP)}>
              <Plus className="size-4" aria-hidden="true" />
              <span className="sr-only">Aumentar zoom</span>
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "balanzas-process relative overscroll-contain overflow-auto rounded-[24px] border border-border/70 bg-white/95 dark:bg-slate-900/70",
          isPanning ? "cursor-grabbing select-none" : "cursor-grab",
        )}
        style={{ height: "clamp(560px, calc(100vh - 340px), 1080px)", scrollbarGutter: "stable both-edges" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        onClickCapture={suppressDraggedClick}
      >
        <div className="relative" style={{ width: renderedW, height: renderedH }}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width={renderedW}
            height={renderedH}
            xmlns="http://www.w3.org/2000/svg"
            className="block"
          >
            <defs>
              <marker id="bal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={C.flow} />
              </marker>
              <pattern id="bal-grid" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.7" fill="var(--bal-grid)" />
              </pattern>
            </defs>

            <rect width={VB_W} height={VB_H} fill="url(#bal-grid)" />
            <line x1={150} y1={Y.raiz} x2={VB_W - 130} y2={Y.raiz} stroke={C.divider} strokeWidth={0.9} strokeDasharray="6 4" />

            <Edges />
            <RouteLabels />
            <DestLabels />
            <Notes />
            <StaticShapes />

            {Object.entries(NODE_LAYOUT).map(([elementId, rect]) => {
              const node = elementToNode.get(elementId);
              const isInteractive = Boolean(node);
              const isSelected = node?.key === selectedNodeKey;
              const isInactive = elementId.includes("_Pre_GV");
              const taskName = TASK_LABELS[elementId] ?? "";
              const fill = rect.kind === "general" ? C.genFill : C.taskFill;
              const stroke = isSelected ? C.selected : rect.kind === "general" ? C.genStroke : C.taskStroke;
              const text = rect.kind === "general" ? C.genText : C.taskText;
              return (
                <g
                  key={elementId}
                  className={cn(isInteractive && "cursor-pointer")}
                  onClick={isInteractive ? () => onNodeSelect(node!.key) : undefined}
                  style={{ opacity: isInactive ? 0.4 : 1 }}
                >
                  <rect
                    x={rect.cx - rect.w / 2}
                    y={rect.cy - rect.h / 2}
                    width={rect.w}
                    height={rect.h}
                    rx={6}
                    ry={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2.6 : STROKE_W}
                  />
                  <text
                    x={rect.cx}
                    y={rect.cy + 4}
                    textAnchor="middle"
                    fontFamily="var(--font-app), Inter, sans-serif"
                    fontSize={rect.kind === "general" ? 12 : taskName.length > 10 ? 10 : 12}
                    fontWeight={700}
                    fill={text}
                  >
                    {taskName}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Overlays HTML pixel-perfect sobre cada nodo activo */}
          {nodes.map((node) =>
            node.processBindings.map((b) => {
              const rect = NODE_LAYOUT[b.elementId];
              if (!rect) return null;
              const hasOverlaySiblings = (overlayCountByElement.get(b.elementId) ?? 0) > 1;
              const leftPx = (rect.cx + (hasOverlaySiblings ? node.overlayOffsetLeft : 0)) * zoom;
              const topPx = (rect.cy - rect.h / 2 - 4) * zoom;
              const isSelected = node.key === selectedNodeKey;
              // Nodos split por destino (3 sub-rows ARC/BLC/TNT en mismo
              // column) → card ULTRA-compacta: solo título + última métrica
              // (típicamente el % diff/cumplimiento). Evita solape con la
               // columna PELADO TALLOS Y CLASIFICADO / CLASIFICADO de al lado.
              const isDestSplit = node.key.includes("::");
              const maxMetrics = isDestSplit ? 1 : 3;
              const cardWidth = isDestSplit ? 140 : 168;
              const visibleMetrics = isDestSplit
                ? node.metrics.slice(-1) // última métrica = indicador clave
                : node.metrics.slice(0, maxMetrics);
              return (
                <button
                  key={`${node.key}-${b.elementId}`}
                  type="button"
                  onClick={() => onNodeSelect(node.key)}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-full rounded-xl border-2 px-2.5 py-1.5 text-left shadow-[0_8px_22px_-12px_rgba(15,23,42,0.5)] backdrop-blur-sm transition-all hover:scale-[1.04] hover:shadow-[0_12px_30px_-12px_rgba(15,23,42,0.6)]",
                    node.status === "ready"
                      ? isSelected
                        ? "border-blue-700 bg-white text-slate-900"
                        : "border-emerald-500/80 bg-white/97 text-slate-900"
                      : "border-slate-400/60 bg-slate-100/96 text-slate-500",
                  )}
                  style={{ left: leftPx, top: topPx, width: cardWidth }}
                >
                  <div className="mb-1 truncate text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700/90">
                    {node.label}
                  </div>
                  <table className="w-full border-collapse">
                    <tbody>
                      {visibleMetrics.map((m, i) => {
                        const isLast = i === visibleMetrics.length - 1;
                        const isNeg = m.formatted.startsWith("-");
                        const valueClass = isLast
                          ? node.status !== "ready"
                            ? "text-slate-400"
                            : isNeg
                              ? "text-red-600 font-bold"
                              : "text-emerald-700 font-bold"
                          : "text-slate-700";
                        return (
                          <tr key={m.label}>
                            <td className="pr-2 text-[9.5px] whitespace-nowrap text-slate-500">{m.label}</td>
                            <td className={cn("text-[9.5px] tabular-nums whitespace-nowrap text-right", valueClass)}>{m.formatted}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
