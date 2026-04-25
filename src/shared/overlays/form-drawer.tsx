"use client";

import type { FormEvent, ReactNode } from "react";

import { SheetShell } from "@/shared/overlays/sheet-shell";
import { Button } from "@/shared/ui/button";

/**
 * Drawer canónico para formularios medianos/largos que requieren contexto de página.
 *
 * Cuándo usar: editar entidad, crear registro, configurar parámetros que conviene
 * mantener junto a la vista de origen. Provee footer pegajoso con botones primario/cancelar.
 *
 * Cuándo NO usar: lectura sola — usar `DetailDrawer`. Confirmaciones — `ConfirmDialog`.
 * Formulario muy corto (1–2 campos) — `DialogShell` directo.
 */
export function FormDrawer({
  open,
  title,
  description,
  side = "right",
  widthClassName = "max-w-2xl",
  isSubmitting = false,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  onSubmit,
  onClose,
  headerActions,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  side?: "right" | "left";
  widthClassName?: string;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      side={side}
      widthClassName={widthClassName}
      headerActions={headerActions}
    >
      <form onSubmit={onSubmit} className="flex h-full flex-col gap-4">
        <div className="flex-1 space-y-4">{children}</div>
        <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border/70 bg-card/96 px-5 py-4 backdrop-blur">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : submitLabel}
          </Button>
        </div>
      </form>
    </SheetShell>
  );
}
