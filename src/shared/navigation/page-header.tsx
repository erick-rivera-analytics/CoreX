"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Breadcrumb, type BreadcrumbItem } from "@/shared/navigation/breadcrumb";

/**
 * Encabezado canónico para páginas no-explorer (admin, mi-cuenta, mi-trabajo,
 * páginas de gestión, formularios largos).
 *
 * IMPORTANTE: NO reemplaza a `SectionPageShell`. Los explorers (campo, fenograma,
 * mortandades, productividad, balanzas, etc.) siguen usando `SectionPageShell`,
 * que es el shell completo con eyebrow + filtros + KPIs.
 *
 * `PageHeader` es solo el header (con breadcrumb opcional y acciones), pensado
 * para vistas más simples sin la estructura de shell.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumb items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
