"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Toolbar canónico: row con slots `start`, `center`, `end`.
 *
 * Para barras de acciones encima de tablas o secciones (búsqueda, filtros rápidos,
 * acciones masivas, vistas, exportar). No usar como contenedor de filtros principales
 * — esos van en `FilterPanel`.
 */
export function Toolbar({
  start,
  center,
  end,
  className,
}: {
  start?: ReactNode;
  center?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {start ? <div className="flex flex-1 items-center gap-2 min-w-0">{start}</div> : null}
      {center ? <div className="flex items-center gap-2">{center}</div> : null}
      {end ? <div className="flex items-center gap-2">{end}</div> : null}
    </div>
  );
}
