"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import useSWR from "swr";

import type { BalanzasNodeData } from "@/lib/postcosecha-balanzas";
import {
  centerProcessOnElementIds,
  getNodeMarkerClass,
  isInteractiveProcessNode,
  resolveProcessSelection,
  scrollProcessToLane,
  type ProcessSearchResult,
  type ViewerApi,
} from "@/modules/postcosecha/lib/balanzas-process-engine-helpers";
import {
  reportBindingDrift,
  validateBindings,
} from "@/modules/postcosecha/lib/balanzas-process-binding";
import type {
  BalanzasProcessSelection,
  ProcessLane,
  SearchableProcessElement,
} from "@/modules/postcosecha/lib/balanzas-process-stages";
import { getProcessSelection } from "@/modules/postcosecha/lib/balanzas-process-stages";
import { cn } from "@/lib/utils";

export type ProcessEngineHandle = {
  zoomBy: (step: number) => number;
  fitViewport: () => number;
  getZoom: () => number;
  scrollToLane: (lane: ProcessLane) => void;
  focusElement: (elementId: string) => void;
  searchNodes: (query: string) => ProcessSearchResult[];
  exportSVG: () => Promise<string>;
};

const textFetcher = (url: string) =>
  fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error("No se pudo cargar el BPMN.");
    }

    return response.text();
  });

export const BalanzasProcessEngine = forwardRef<ProcessEngineHandle, {
  assetPath: string;
  nodes: BalanzasNodeData[];
  selection: BalanzasProcessSelection | null;
  onNodeSelect: (selection: BalanzasProcessSelection) => void;
  onZoomChange?: (zoom: number) => void;
}>(
  function BalanzasProcessEngine(
    { assetPath, nodes, selection, onNodeSelect, onZoomChange },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerRef = useRef<ViewerApi | null>(null);
    const viewerReadyRef = useRef(false);
    const searchableElementsRef = useRef<SearchableProcessElement[]>([]);
    const searchIndexRef = useRef<ProcessSearchResult[]>([]);
    const elementIdsRef = useRef<Record<string, string[]>>({});
    const nodesRef = useRef(nodes);
    const onNodeSelectRef = useRef(onNodeSelect);
    const onZoomChangeRef = useRef(onZoomChange);
    const [viewerError, setViewerError] = useState<string | null>(null);
    const [viewerReady, setViewerReady] = useState(false);
    const { data: xmlData, error: fetchError, isLoading } = useSWR(assetPath, textFetcher);

    nodesRef.current = nodes;
    onNodeSelectRef.current = onNodeSelect;
    onZoomChangeRef.current = onZoomChange;

    useImperativeHandle(ref, () => ({
      zoomBy(step) {
        const viewer = viewerRef.current;
        if (!viewer) {
          return 1;
        }

        const canvas = viewer.get("canvas");
        const nextZoom = Math.max(0.25, Math.min(2.4, canvas.zoom() + step));
        canvas.zoom(nextZoom);
        onZoomChangeRef.current?.(nextZoom);
        return nextZoom;
      },
      fitViewport() {
        const viewer = viewerRef.current;
        if (!viewer) {
          return 1;
        }

        const canvas = viewer.get("canvas");
        const nextZoom = canvas.zoom("fit-viewport", "auto");
        onZoomChangeRef.current?.(nextZoom);
        return nextZoom;
      },
      getZoom() {
        return viewerRef.current?.get("canvas").zoom() ?? 1;
      },
      scrollToLane(lane) {
        const viewer = viewerRef.current;
        if (viewer && viewerReadyRef.current) {
          scrollProcessToLane(viewer, lane, searchableElementsRef.current);
        }
      },
      focusElement(elementId) {
        const viewer = viewerRef.current;
        if (viewer && viewerReadyRef.current) {
          centerProcessOnElementIds(viewer, [elementId]);
        }
      },
      searchNodes(query) {
        if (!viewerReadyRef.current) {
          return [] as ProcessSearchResult[];
        }

        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
          return [] as ProcessSearchResult[];
        }

        return searchIndexRef.current.filter((entry) => (
          entry.name.toLowerCase().includes(normalizedQuery)
          || entry.subtitle.toLowerCase().includes(normalizedQuery)
          || entry.id.toLowerCase().includes(normalizedQuery)
        )).slice(0, 16);
      },
      async exportSVG() {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReadyRef.current) {
          throw new Error("El BPMN todavia no esta listo.");
        }

        const svgResult = await viewer.saveSVG();
        return typeof svgResult === "string" ? svgResult : svgResult.svg;
      },
    }), []);

    useEffect(() => {
      if (!xmlData || !containerRef.current) {
        return;
      }

      let cancelled = false;

      async function initViewer() {
        try {
          const [{ default: NavigatedViewer }, minimapModuleImport] = await Promise.all([
            import("bpmn-js/lib/NavigatedViewer"),
            import("diagram-js-minimap").catch(() => null),
          ]);

          if (cancelled || !containerRef.current) {
            return;
          }

          viewerRef.current?.destroy();
          const minimapModule = minimapModuleImport?.default ?? minimapModuleImport;
          const viewer = new NavigatedViewer({
            container: containerRef.current,
            additionalModules: minimapModule ? [minimapModule as never] : [],
          }) as ViewerApi;

          await viewer.importXML(xmlData!);

          const canvas = viewer.get("canvas");
          const eventBus = viewer.get("eventBus");
          const elementRegistry = viewer.get("elementRegistry");
          const nextElementIds: Record<string, string[]> = {};
          const nextSearchableElements: SearchableProcessElement[] = [];
          const nextSearchIndex: ProcessSearchResult[] = [];

          elementRegistry.forEach((element) => {
            const elementName = element.businessObject?.name?.trim();
            if (elementName) {
              nextSearchableElements.push({ id: element.id, name: elementName });
            }
          });

          for (const node of nodesRef.current) {
            if (!isInteractiveProcessNode(node)) {
              continue;
            }

            for (const binding of node.processBindings) {
              if (!binding.elementId) {
                continue;
              }

              const matchedElement = elementRegistry.get(binding.elementId);
              if (!matchedElement) {
                continue;
              }

              nextElementIds[node.key] ??= [];
              nextElementIds[node.key].push(matchedElement.id);
              nextSearchIndex.push({
                id: matchedElement.id,
                name: node.label,
                subtitle: node.laneLabel,
                selection: getProcessSelection(node.key),
              });
            }
          }

          reportBindingDrift(validateBindings(nodesRef.current, elementRegistry));

          eventBus.on("element.click", (event) => {
            const matchedSelection = resolveProcessSelection(nodesRef.current, event.element);
            if (matchedSelection) {
              onNodeSelectRef.current(matchedSelection);
            }
          });

          eventBus.on("element.hover", (event) => {
            const matchedSelection = resolveProcessSelection(nodesRef.current, event.element);
            if (matchedSelection) {
              canvas.addMarker(event.element.id, "balanzas-node-hover");
            }
          });

          eventBus.on("element.out", (event) => {
            canvas.removeMarker(event.element.id, "balanzas-node-hover");
          });

          const zoom = canvas.zoom("fit-viewport", "auto");
          viewerRef.current = viewer;
          viewerReadyRef.current = true;
          searchableElementsRef.current = nextSearchableElements;
          searchIndexRef.current = nextSearchIndex;
          elementIdsRef.current = nextElementIds;
          onZoomChangeRef.current?.(zoom);

          if (!cancelled) {
            setViewerError(null);
            setViewerReady(true);
          }
        } catch (error) {
          if (!cancelled) {
            setViewerError(error instanceof Error ? error.message : "No se pudo preparar el flujo BPMN.");
            setViewerReady(false);
            viewerReadyRef.current = false;
          }
        }
      }

      initViewer();

      return () => {
        cancelled = true;
        viewerRef.current?.destroy();
        viewerRef.current = null;
        viewerReadyRef.current = false;
        searchableElementsRef.current = [];
        searchIndexRef.current = [];
        elementIdsRef.current = {};
        setViewerReady(false);
      };
    }, [xmlData]);

    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || !viewerReady) {
        return;
      }

      const canvas = viewer.get("canvas");

      for (const node of nodes) {
        const markerClass = getNodeMarkerClass(node);
        const elementIds = elementIdsRef.current[node.key] ?? [];

        for (const elementId of elementIds) {
          canvas.removeMarker(elementId, markerClass);
          canvas.removeMarker(elementId, "balanzas-node-selected");
          canvas.removeMarker(elementId, "balanzas-node-unavailable");
          canvas.removeMarker(elementId, "balanzas-node-hover");
          canvas.removeMarker(elementId, "balanzas-node-dimmed");
        }
      }

      const hasSelection = Boolean(selection);

      for (const node of nodes) {
        if (!isInteractiveProcessNode(node)) {
          continue;
        }

        const markerClass = getNodeMarkerClass(node);
        const elementIds = elementIdsRef.current[node.key] ?? [];
        const isSelected = selection?.nodeKey === node.key;

        for (const elementId of elementIds) {
          canvas.addMarker(elementId, markerClass);

          if (node.status !== "ready") {
            canvas.addMarker(elementId, "balanzas-node-unavailable");
          }

          if (isSelected) {
            canvas.addMarker(elementId, "balanzas-node-selected");
          } else if (hasSelection) {
            canvas.addMarker(elementId, "balanzas-node-dimmed");
          }
        }
      }
    }, [nodes, selection, viewerReady]);

    const loading = isLoading || (!fetchError && !viewerError && xmlData && !viewerReady);
    const error = fetchError ? "No se pudo cargar el diagrama BPMN de postcosecha." : viewerError;

    return (
      <div className="balanzas-process relative h-full min-h-[600px] overflow-hidden">
        <div
          ref={containerRef}
          className={cn("h-full w-full", (loading || error) && "opacity-0")}
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
    );
  },
);
