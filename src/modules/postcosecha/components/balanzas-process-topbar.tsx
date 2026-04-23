"use client";

import { Download, ExternalLink, Maximize2, Minus, Plus, Search } from "lucide-react";

import type { BalanzasProcessSelection } from "@/modules/postcosecha/lib/balanzas-process-stages";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/lib/utils";

export type BalanzasProcessSearchResult = {
  id: string;
  name: string;
  subtitle?: string;
  selection?: BalanzasProcessSelection;
};

export function BalanzasProcessTopbar({
  zoomPct,
  searchQuery,
  searchResults,
  onSearchChange,
  onSearchSelect,
  onZoomIn,
  onZoomOut,
  onFit,
  onExport,
  onOpenCleanMap,
}: {
  zoomPct: number;
  searchQuery: string;
  searchResults: BalanzasProcessSearchResult[];
  onSearchChange: (value: string) => void;
  onSearchSelect: (result: BalanzasProcessSearchResult) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onExport: () => void;
  onOpenCleanMap: () => void;
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/92 px-4 py-2">
      <div className="flex items-center gap-2.5">
        <h2 className="text-sm font-semibold">Flujo de Postcosecha</h2>
        <Badge variant="outline" className="rounded-full px-2 text-[10px]">
          BPMN
        </Badge>
      </div>

      <div className="relative w-full max-w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-8 rounded-full border-border/60 bg-background/60 pl-8 text-sm"
          placeholder="Buscar nodo..."
        />
        {searchQuery.trim() ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-20 overflow-hidden rounded-[18px] border border-border/70 bg-popover shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)]">
            {searchResults.length ? (
              <div className="max-h-64 overflow-auto py-1.5">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                    onClick={() => onSearchSelect(result)}
                  >
                    <div className="min-w-0">
                      <span className="block truncate">{result.name}</span>
                      {result.subtitle ? (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {result.subtitle}
                        </span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      {result.id}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                Sin coincidencias en el BPMN actual.
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-full text-xs"
          onClick={onOpenCleanMap}
        >
          <ExternalLink className="size-3.5" />
          Ver mapa limpio
        </Button>
        <div className="flex items-center gap-0.5 rounded-full border border-border/70 bg-background/88 p-1 shadow-sm">
          <Button size="icon" variant="ghost" className="size-7 rounded-full" onClick={onZoomOut}>
            <Minus className="size-3.5" />
          </Button>
          <span className={cn("w-11 text-center text-xs text-muted-foreground", "tabular-nums")}>
            {zoomPct}%
          </span>
          <Button size="icon" variant="ghost" className="size-7 rounded-full" onClick={onFit}>
            <Maximize2 className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 rounded-full" onClick={onZoomIn}>
            <Plus className="size-3.5" />
          </Button>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full text-xs" onClick={onExport}>
          <Download className="size-3.5" />
          Exportar
        </Button>
      </div>
    </div>
  );
}
