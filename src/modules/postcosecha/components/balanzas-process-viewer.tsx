"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import type {
  BalanzasDestinationBreakdown,
  BalanzasNodeKey,
  BalanzasProcessBinding,
  BalanzasViewStatus,
} from "@/lib/postcosecha-balanzas";

type BalanzasProcessViewerProps = {
  assetPath: string;
  metricLabel: string;
  nodes: BalanzasProcessNodeView[];
  selectedNodeKey: BalanzasNodeKey | null;
  onNodeSelect: (nodeKey: BalanzasNodeKey, destination?: string | null) => void;
};

type BalanzasProcessNodeView = {
  key: BalanzasNodeKey;
  shortLabel: string;
  label: string;
  ratioDisplay: string;
  sourceTotalDisplay: string;
  targetTotalDisplay: string;
  status: BalanzasViewStatus;
  processBindings: BalanzasProcessBinding[];
  destinationBreakdown: BalanzasDestinationBreakdown[];
};

type ViewerApi = {
  destroy: () => void;
  importXML: (xml: string) => Promise<unknown>;
  get(service: "canvas"): {
    zoom: (level?: number | "fit-viewport", center?: "auto") => number;
    addMarker: (elementId: string, marker: string) => void;
    removeMarker: (elementId: string, marker: string) => void;
  };
  get(service: "eventBus"): {
    on: (
      eventName: "element.click",
      handler: (event: { element: ProcessElement }) => void,
    ) => void;
  };
  get(service: "elementRegistry"): {
    forEach: (callback: (element: ProcessElement) => void) => void;
  };
  get(service: "overlays"): {
    clear: () => void;
    add: (
      elementId: string,
      config: {
        position: { top: number; left: number };
        html: HTMLElement;
      },
    ) => void;
  };
};

type ProcessElement = {
  id: string;
  x?: number;
  y?: number;
  businessObject?: {
    name?: string;
  };
};

const NODE_CLASS_MAP: Record<BalanzasNodeKey, string> = {
  apertura_pelado_patas: "balanzas-node-apertura",
  b2: "balanzas-node-b2",
  b2a: "balanzas-node-b2a",
};

const textFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load");
    return r.text();
  });

function matchesSingleBinding(binding: BalanzasProcessBinding, element: ProcessElement) {
  const name = element.businessObject?.name?.trim() ?? "";
  const y = element.y ?? 0;

  return (
    (!binding.elementId || binding.elementId === element.id)
    && binding.taskName === name
    && (binding.minY === undefined || y >= binding.minY)
    && (binding.maxY === undefined || y <= binding.maxY)
  );
}

function resolveNodeSelection(nodes: BalanzasProcessNodeView[], element: ProcessElement) {
  for (const node of nodes) {
    for (const binding of node.processBindings) {
      if (!matchesSingleBinding(binding, element)) {
        continue;
      }

      return {
        nodeKey: node.key,
        destination: binding.destination ?? null,
      };
    }
  }

  return null;
}

function createOverlayElement(
  node: BalanzasProcessNodeView,
  breakdown?: BalanzasDestinationBreakdown,
  pathLabel?: string,
) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = cn(
    "balanzas-node-overlay rounded-2xl border px-3 py-2 text-left shadow-lg backdrop-blur-sm",
    node.status === "ready"
      ? "border-white/80 bg-white/96 text-slate-900"
      : "border-slate-300/80 bg-slate-100/96 text-slate-600",
  );
  element.dataset.nodeKey = node.key;

  const title = breakdown?.pathLabel ?? pathLabel ?? node.shortLabel;
  const ratio = breakdown?.ratioDisplay ?? node.ratioDisplay;
  const totals = breakdown
    ? `${breakdown.sourceTotalDisplay} / ${breakdown.targetTotalDisplay}`
    : `${node.sourceTotalDisplay} / ${node.targetTotalDisplay}`;
  const subtitle = node.label;

  element.innerHTML = `
    <div class="text-[10px] uppercase tracking-[0.24em] ${node.status === "ready" ? "text-slate-500" : "text-slate-400"}">${title}</div>
    <div class="mt-1 text-sm font-semibold leading-tight">${ratio}</div>
    <div class="mt-1 text-[11px] ${node.status === "ready" ? "text-slate-600" : "text-slate-400"}">${subtitle}</div>
    <div class="mt-1 text-[11px] ${node.status === "ready" ? "text-slate-500" : "text-slate-400"}">${totals}</div>
  `;

  return element;
}

export function BalanzasProcessViewer({
  assetPath,
  metricLabel,
  nodes,
  selectedNodeKey,
  onNodeSelect,
}: BalanzasProcessViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ViewerApi | null>(null);
  const elementIdsRef = useRef<Record<string, string[]>>({});
  const onNodeSelectRef = useRef(onNodeSelect);
  const nodesRef = useRef(nodes);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);

  // Keep refs current on every render so event handlers and the init effect
  // always use the latest values without needing them as effect dependencies.
  onNodeSelectRef.current = onNodeSelect;
  nodesRef.current = nodes;

  const { data: xmlData, error: fetchError, isLoading } = useSWR(assetPath, textFetcher);

  useEffect(() => {
    if (!xmlData || !containerRef.current) {
      return;
    }

    let cancelled = false;

    async function initViewer() {
      if (!containerRef.current) {
        return;
      }

      setViewerError(null);

      try {
        const { default: NavigatedViewer } = await import("bpmn-js/lib/NavigatedViewer");

        if (cancelled || !containerRef.current) {
          return;
        }

        viewerRef.current?.destroy();
        const viewer = new NavigatedViewer({
          container: containerRef.current,
        }) as ViewerApi;

        await viewer.importXML(xmlData!);

        const canvas = viewer.get("canvas");
        const eventBus = viewer.get("eventBus");
        const elementRegistry = viewer.get("elementRegistry");
        const nextElementIds: Record<string, string[]> = {};

        elementRegistry.forEach((element) => {
          for (const node of nodesRef.current) {
            for (const binding of node.processBindings) {
              if (!matchesSingleBinding(binding, element)) {
                continue;
              }

              nextElementIds[node.key] ??= [];
              nextElementIds[node.key].push(element.id);
            }
          }
        });

        eventBus.on("element.click", (event) => {
          const matchedSelection = resolveNodeSelection(nodesRef.current, event.element);

          if (matchedSelection) {
            onNodeSelectRef.current(matchedSelection.nodeKey, matchedSelection.destination);
          }
        });

        canvas.zoom("fit-viewport", "auto");
        viewerRef.current = viewer;
        elementIdsRef.current = nextElementIds;

        if (!cancelled) {
          setViewerReady(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setViewerError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo preparar el flujo de postcosecha.",
          );
          setViewerReady(false);
        }
      }
    }

    initViewer();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      setViewerReady(false);
    };
  }, [xmlData]);

  useEffect(() => {
    if (!viewerReady || !viewerRef.current) {
      return;
    }

    const viewer = viewerRef.current;
    const overlays = viewer.get("overlays");
    const canvas = viewer.get("canvas");

    overlays.clear();

    for (const node of nodes) {
      const markerClass = NODE_CLASS_MAP[node.key];
      const elementIds = elementIdsRef.current[node.key] ?? [];

      for (const elementId of elementIds) {
        canvas.removeMarker(elementId, markerClass);
        canvas.removeMarker(elementId, "balanzas-node-selected");
        canvas.removeMarker(elementId, "balanzas-node-unavailable");
      }
    }

    for (const node of nodes) {
      const markerClass = NODE_CLASS_MAP[node.key];
      const elementIds = elementIdsRef.current[node.key] ?? [];

      for (const binding of node.processBindings) {
        const bindingElementIds = binding.elementId
          ? elementIds.filter((elementId) => elementId === binding.elementId)
          : elementIds;

        for (const elementId of bindingElementIds) {
          const breakdown = binding.destination
            ? node.destinationBreakdown.find((entry) => entry.destination === binding.destination)
            : undefined;
          const overlay = createOverlayElement(node, breakdown, binding.pathLabel);
          overlay.addEventListener("click", () => onNodeSelectRef.current(node.key, binding.destination ?? null));

          overlays.add(elementId, {
            position: {
              top: 6,
              left: 8,
            },
            html: overlay,
          });
          canvas.addMarker(elementId, markerClass);

          if (node.status !== "ready") {
            canvas.addMarker(elementId, "balanzas-node-unavailable");
          }

          if (selectedNodeKey === node.key) {
            canvas.addMarker(elementId, "balanzas-node-selected");
          }
        }
      }
    }
  }, [nodes, selectedNodeKey, viewerReady]);

  function zoomBy(step: number) {
    if (!viewerRef.current) {
      return;
    }

    const canvas = viewerRef.current.get("canvas");
    const currentZoom = canvas.zoom();
    canvas.zoom(Math.max(0.25, Math.min(2.4, currentZoom + step)));
  }

  function fitViewport() {
    if (!viewerRef.current) {
      return;
    }

    const canvas = viewerRef.current.get("canvas");
    canvas.zoom("fit-viewport", "auto");
  }

  const loading = isLoading || (!fetchError && !viewerError && xmlData && !viewerReady);
  const error = fetchError
    ? "No se pudo cargar el diagrama BPMN de postcosecha."
    : viewerError;

  return (
    <div className="rounded-[30px] border border-border/70 bg-[linear-gradient(180deg,rgba(254,254,252,0.98),rgba(238,245,242,0.96))] p-3 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] dark:bg-[linear-gradient(180deg,rgba(26,32,40,0.98),rgba(18,23,31,0.98))]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm text-muted-foreground">
          Haz clic sobre BAL1 / BAL1C, BAL1C / BAL2 o BAL2 / BAL2A para abrir el detalle. Cada nodo resume el macro indicador de {metricLabel.toLowerCase()} y en BAL2 / BAL2A el BPMN se desdobla por Arcoiris, Tinturado y Blanco.
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/88 p-1 shadow-sm">
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => zoomBy(-0.1)}>
            <Minus className="size-4" aria-hidden="true" />
            <span className="sr-only">Reducir zoom</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={fitViewport}>
            <Maximize2 className="size-4" aria-hidden="true" />
            <span className="sr-only">Ajustar al viewport</span>
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => zoomBy(0.1)}>
            <Plus className="size-4" aria-hidden="true" />
            <span className="sr-only">Aumentar zoom</span>
          </Button>
        </div>
      </div>

      <div className="balanzas-process relative overflow-auto rounded-[24px] border border-border/70 bg-white/90 dark:bg-slate-900/70">
        <div
          ref={containerRef}
          className={cn(
            "h-[820px] min-h-[820px] w-full min-w-[1220px]",
            (loading || error) && "opacity-0",
          )}
        />

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Cargando flujo de postcosecha...
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
