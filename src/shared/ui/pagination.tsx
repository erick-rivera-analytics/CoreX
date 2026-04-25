"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

/**
 * Paginación canónica para tablas.
 *
 * Pura presentación: el caller decide la fuente de datos y aplica `page`/`pageSize`.
 * Soporta selector de tamaño de página (opcional).
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 text-xs", className)}>
      <p className="text-muted-foreground">
        {total === 0 ? "Sin registros" : `Mostrando ${start}–${end} de ${total}`}
      </p>
      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-muted-foreground">
            <span>Filas:</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 rounded-[10px] border border-input bg-background px-2 text-xs text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Página anterior"
            className="flex size-8 items-center justify-center rounded-[10px] border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="px-2 text-foreground">
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            aria-label="Página siguiente"
            className="flex size-8 items-center justify-center rounded-[10px] border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
