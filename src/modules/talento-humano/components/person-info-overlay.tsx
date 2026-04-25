"use client";

import { PersonProfileDialog } from "@/shared/overlays/person-profile-dialog";

/**
 * Wrapper canónico para abrir la ficha del personal desde Talento Humano
 * (composición laboral, demografía personal, rotación laboral). Delega a
 * `PersonProfileDialog` con `sourceContext.module = "talento"` — sin contexto
 * de ciclo, la tab "Rendimiento" muestra empty state. Tab "Información" usa
 * los datos canónicos de RH; tab "Ficha médica" funciona vía endpoint propio.
 */
export function PersonInfoOverlay({
  personId,
  personName: _personName,
  onClose,
}: {
  personId: string;
  /** @deprecated Mantenido por compatibilidad de API; el nombre se resuelve dentro del diálogo. */
  personName?: string;
  onClose: () => void;
}) {
  return (
    <PersonProfileDialog
      open
      personId={personId}
      sourceContext={{ module: "talento" }}
      onClose={onClose}
    />
  );
}
