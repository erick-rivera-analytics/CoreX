"use client";

import type { ReactNode } from "react";

import { SheetShell } from "@/shared/overlays/sheet-shell";

/**
 * Drawer canónico para visualización de detalle de una entidad (read-only).
 *
 * Cuándo usar: ficha de persona, detalle de bloque/ciclo, perfil de registro.
 * Acepta `headerActions` (ej. botón de editar que abre un `FormDrawer`).
 *
 * Cuándo NO usar: edición — usar `FormDrawer`. Confirmaciones — `ConfirmDialog`.
 */
export function DetailDrawer({
  open,
  title,
  description,
  side = "right",
  widthClassName = "max-w-3xl",
  headerActions,
  footer,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  side?: "right" | "left";
  widthClassName?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
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
      footer={footer}
    >
      {children}
    </SheetShell>
  );
}
