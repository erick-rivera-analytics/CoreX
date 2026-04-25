"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Panel canónico in-page para mostrar detalle de una entidad sin overlay.
 *
 * Cuándo usar: cuando el detalle debe quedar visible junto al contexto (master-detail)
 * y sin oscurecer el resto de la pantalla. Layout right-rail típico.
 *
 * Cuándo NO usar: si el detalle ocupa la mayor parte de la pantalla — usar `DetailDrawer`
 * o página dedicada. Si requiere modo modal — usar `DialogShell`.
 */
export function EntityDetailPanel({
  title,
  description,
  headerActions,
  footer,
  className,
  contentClassName,
  children,
}: {
  title?: string;
  description?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={cn(
        "flex flex-col overflow-hidden rounded-[var(--radius-surface)] border border-border/70 bg-card",
        "shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      {(title || description || headerActions) ? (
        <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0 flex-1">
            {title ? <h3 className="text-base font-semibold tracking-tight">{title}</h3> : null}
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5", contentClassName)}>
        {children}
      </div>
      {footer ? (
        <div className="border-t border-border/70 bg-card/96 px-5 py-4">{footer}</div>
      ) : null}
    </aside>
  );
}
