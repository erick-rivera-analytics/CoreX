"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import useSWR from "swr";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import { cn } from "@/lib/utils";

type ProcessViewerOverlayProps = {
  title: string;
  subtitle?: string;
  assetPath: string;
  onClose: () => void;
};

type ViewerApi = {
  destroy: () => void;
  importXML: (xml: string) => Promise<unknown>;
  get(service: "canvas"): {
    zoom: (level?: number | "fit-viewport", center?: "auto") => number;
  };
};

const textFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load");
    return r.text();
  });

/**
 * Componente reusable para mostrar un BPMN en ventana flotante.
 * Sigue el patrón técnico de balanzas-process-viewer.tsx pero sin overlays.
 *
 * Punto de conexión del BPMN:
 * - El asset se espera como archivo estático en `public/processes/`.
 * - Para campo, crear `public/processes/campo-macroproceso-es.bpmn`
 *   y pasar la ruta como prop `assetPath`.
 * - Mientras no exista el asset, el componente muestra un mensaje informativo.
 */
export function ProcessViewerOverlay({
  title,
  subtitle,
  assetPath,
  onClose,
}: ProcessViewerOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ViewerApi | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

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
        canvas.zoom("fit-viewport", "auto");
        viewerRef.current = viewer;
      } catch (loadError) {
        if (!cancelled) {
          setViewerError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo preparar el visor del proceso.",
          );
        }
      }
    }

    initViewer();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [xmlData]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

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

  const loading = isLoading || (!fetchError && !viewerError && xmlData && !viewerRef.current);
  const error = fetchError
    ? "No se pudo cargar el diagrama BPMN. Verifica que el archivo existe en la ruta configurada."
    : viewerError;

  return (
    <DialogShell
      title={title}
      description={subtitle}
      onClose={onClose}
      maxWidth="max-w-7xl"
      headerActions={
        <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              Macroproceso
            </Badge>
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
      }
    >
          <div className="relative overflow-auto rounded-[24px] border border-border/70 bg-white/90 dark:bg-slate-950/40">
            <div
              ref={containerRef}
              className={cn(
                "h-[680px] min-h-[680px] w-full min-w-[1000px]",
                (loading || error) && "opacity-0",
              )}
            />

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Cargando diagrama del macroproceso...
              </div>
            ) : null}

            {error ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
    </DialogShell>
  );
}
