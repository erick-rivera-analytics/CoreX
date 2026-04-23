import type { BalanzasNodeData, BalanzasProcessBinding } from "@/lib/postcosecha-balanzas";
import type {
  BalanzasProcessSelection,
  ProcessLane,
  SearchableProcessElement,
} from "@/modules/postcosecha/lib/balanzas-process-stages";
import {
  getProcessSelection,
  resolveLaneViewportTargetIds,
} from "@/modules/postcosecha/lib/balanzas-process-stages";
import { cn } from "@/lib/utils";

export type ProcessElement = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  businessObject?: {
    name?: string;
  };
};

type BoundedProcessElement = ProcessElement & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasViewbox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ProcessSearchResult = SearchableProcessElement & {
  subtitle: string;
  selection: BalanzasProcessSelection;
};

export type ViewerApi = {
  destroy: () => void;
  importXML: (xml: string) => Promise<unknown>;
  saveSVG: () => Promise<string | { svg: string }>;
  get(service: "canvas"): {
    zoom: (level?: number | "fit-viewport", center?: "auto") => number;
    viewbox: (box?: Partial<CanvasViewbox>) => CanvasViewbox;
    addMarker: (elementId: string, marker: string) => void;
    removeMarker: (elementId: string, marker: string) => void;
  };
  get(service: "eventBus"): {
    on: (eventName: string, handler: (event: { element: ProcessElement }) => void) => void;
  };
  get(service: "elementRegistry"): {
    get: (id: string) => ProcessElement | undefined;
    forEach: (callback: (element: ProcessElement) => void) => void;
  };
  get(service: "overlays"): {
    clear: () => void;
    add: (
      elementId: string,
      config: { position: { top: number; left: number }; html: HTMLElement },
    ) => void;
  };
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasFiniteBounds(element: ProcessElement | undefined): element is BoundedProcessElement {
  return Boolean(
    element
    && isFiniteNumber(element.x)
    && isFiniteNumber(element.y)
    && isFiniteNumber(element.width)
    && isFiniteNumber(element.height)
    && element.width > 0
    && element.height > 0,
  );
}

export function getNodeMarkerClass(node: BalanzasNodeData) {
  return node.kind === "aggregate" ? "balanzas-node-aggregate" : "balanzas-node-metric";
}

export function isInteractiveProcessNode(node: BalanzasNodeData) {
  return node.key !== "b1_preclasificacion" && node.key !== "b1_apertura";
}

/**
 * Strict binding match. The canonical rule is `elementId` exact equality against
 * the BPMN element. Y-bounds and name-based fallbacks were removed to avoid
 * silent drift when the BPMN XML changes — see balanzas-process-binding.ts
 * for the validation helper that surfaces missing bindings in dev.
 */
export function matchesProcessBinding(binding: BalanzasProcessBinding, element: ProcessElement) {
  return Boolean(binding.elementId) && binding.elementId === element.id;
}

export function resolveProcessSelection(nodes: BalanzasNodeData[], element: ProcessElement) {
  for (const node of nodes) {
    if (!isInteractiveProcessNode(node)) {
      continue;
    }

    for (const binding of node.processBindings) {
      if (matchesProcessBinding(binding, element)) {
        return getProcessSelection(node.key);
      }
    }
  }

  return null as BalanzasProcessSelection | null;
}

export function buildProcessOverlayElement(node: BalanzasNodeData) {
  const element = document.createElement("button");
  element.type = "button";

  const isAggregate = node.kind === "aggregate";

  element.className = cn(
    "balanzas-node-overlay rounded-xl border px-2.5 py-2 text-left backdrop-blur-md transition-shadow",
    "shadow-[0_2px_12px_-4px_rgba(15,23,42,0.18),0_1px_3px_-1px_rgba(15,23,42,0.08)]",
    "hover:shadow-[0_4px_20px_-4px_rgba(15,23,42,0.22)]",
    isAggregate
      ? "border-orange-200/80 bg-orange-50/98 text-orange-950 dark:border-orange-500/30 dark:bg-orange-950/80 dark:text-orange-100"
      : "border-slate-200/80 bg-white/98 text-slate-900 dark:border-slate-700/60 dark:bg-slate-950/90 dark:text-slate-100",
  );

  const labelColor = isAggregate
    ? "color:rgba(154,52,18,0.75)"
    : "color:rgba(100,116,139,0.85)";
  const metricColor = isAggregate
    ? "color:rgba(154,52,18,0.9)"
    : "color:rgba(71,85,105,0.9)";
  const caption = isAggregate ? "GENERAL" : node.laneLabel;

  element.innerHTML = `
    <div style="font-size:9px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;${labelColor}">${caption}</div>
    <div style="margin-top:2px;font-size:12px;font-weight:700;line-height:1.25">${node.label}</div>
    <div style="margin-top:3px;font-size:10.5px;${metricColor}">${node.focusStage}: <strong>${node.primaryTotalDisplay}</strong></div>
    <div style="margin-top:1px;font-size:10px;${metricColor};opacity:0.82">${node.ratioDisplay} &middot; ${node.rowCount} filas</div>
  `;

  return element;
}

export function centerProcessOnElementIds(viewer: ViewerApi, elementIds: string[]) {
  const elementRegistry = viewer.get("elementRegistry");
  const canvas = viewer.get("canvas");
  const elements = elementIds
    .map((elementId) => elementRegistry.get(elementId))
    .filter(hasFiniteBounds);

  if (!elements.length) {
    return false;
  }

  const minX = Math.min(...elements.map((element) => element.x));
  const minY = Math.min(...elements.map((element) => element.y));
  const maxX = Math.max(...elements.map((element) => element.x + element.width));
  const maxY = Math.max(...elements.map((element) => element.y + element.height));
  const currentViewbox = canvas.viewbox();

  if (
    !Number.isFinite(minX)
    || !Number.isFinite(minY)
    || !Number.isFinite(maxX)
    || !Number.isFinite(maxY)
    || !Number.isFinite(currentViewbox.width)
    || !Number.isFinite(currentViewbox.height)
    || currentViewbox.width <= 0
    || currentViewbox.height <= 0
  ) {
    return false;
  }

  const nextX = minX + (maxX - minX) / 2 - currentViewbox.width / 2;
  const nextY = minY + (maxY - minY) / 2 - currentViewbox.height / 2;

  if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
    return false;
  }

  try {
    canvas.viewbox({
      x: nextX,
      y: nextY,
      width: currentViewbox.width,
      height: currentViewbox.height,
    });
    return true;
  } catch {
    return false;
  }
}

export function scrollProcessToLane(
  viewer: ViewerApi,
  lane: ProcessLane,
  elements: SearchableProcessElement[],
) {
  const targetIds = resolveLaneViewportTargetIds(lane, elements);
  const centered = centerProcessOnElementIds(viewer, targetIds);

  if (!centered) {
    viewer.get("canvas").zoom("fit-viewport", "auto");
  }

  return centered;
}
