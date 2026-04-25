"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Agrupador de campos dentro de un formulario.
 *
 * Provee título + descripción opcional y un slot vertical con `space-y-4`.
 * Usar dentro de `FormDrawer` o cualquier formulario para separar grupos.
 */
export function FormSection({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description) ? (
        <header>
          {title ? <h4 className="text-sm font-semibold tracking-tight">{title}</h4> : null}
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </header>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
