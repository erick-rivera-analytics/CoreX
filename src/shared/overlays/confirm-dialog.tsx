"use client";

import { DialogShell } from "@/shared/overlays/dialog-shell";
import { Button } from "@/shared/ui/button";

/**
 * Diálogo de confirmación canónico para acciones críticas (eliminar, descartar, etc.).
 *
 * Cuándo usar: confirmaciones binarias cortas (sí/no, aceptar/cancelar) sobre
 * una acción que el usuario ya inició desde otra superficie.
 *
 * Cuándo NO usar: formularios — usar `FormDrawer`. Visualización de datos —
 * usar `DialogShell` directo o `DetailDrawer`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "neutral",
  isPending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "neutral" | "danger";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <DialogShell
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      maxWidth="max-w-md"
    >
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={tone === "danger" ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? "Procesando…" : confirmLabel}
        </Button>
      </div>
    </DialogShell>
  );
}
