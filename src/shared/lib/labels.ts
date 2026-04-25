/**
 * Diccionarios canónicos de etiquetas visibles en español.
 *
 * Toda etiqueta orientada al usuario (estados de ciclo, fases, lifecycle, etc.)
 * que hoy se define inline en módulos debe migrar gradualmente a este archivo.
 *
 * Convenciones:
 * - Sentence case en español ("Activo", "Por hacer"). NO MAYÚSCULAS SOSTENIDAS.
 * - Las claves del diccionario son los códigos internos (snake_case o lower-case).
 * - Cuando un código aparece en múltiples dominios con etiquetas distintas,
 *   crear un diccionario específico de ese dominio (`CYCLE_STATUS_LABELS`,
 *   `TASK_STATUS_LABELS`) en vez de un super-diccionario.
 *
 * Audit #1 deja sólo las etiquetas más reusables (lifecycle + estado de ciclo
 * + estado de tarea). El resto migrará en Audit #6.
 */

export type LabelDictionary = Readonly<Record<string, string>>;

/** Estado operacional de un ciclo (campo, fenograma, productividad). */
export const CYCLE_STATUS_LABELS = {
  active: "Activo",
  current: "Activo",
  closed: "Cerrado",
  finished: "Cerrado",
  planned: "Planificado",
  scheduled: "Planificado",
} as const satisfies LabelDictionary;

/** Estado del lifecycle del fenograma (flujo activo / planificado / histórico). */
export const LIFECYCLE_LABELS = {
  active: "Activo",
  planned: "Planificado",
  history: "Histórico",
} as const satisfies LabelDictionary;

/** Estado de tarea personal (mi-trabajo). */
export const TASK_STATUS_LABELS = {
  todo: "Por hacer",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  completed: "Completada",
  cancelled: "Cancelada",
  archived: "Archivada",
} as const satisfies LabelDictionary;

/** Diccionario neutro para badges genéricos de presencia/ausencia. */
export const PRESENCE_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  pending: "Pendiente",
  done: "Completado",
} as const satisfies LabelDictionary;

/**
 * Resuelve una etiqueta del diccionario, con fallback opcional.
 *
 * @example
 * getLabel(CYCLE_STATUS_LABELS, "active")            // "Activo"
 * getLabel(CYCLE_STATUS_LABELS, "unknown", "Otro")   // "Otro"
 * getLabel(CYCLE_STATUS_LABELS, "unknown")           // "unknown" (passthrough)
 */
export function getLabel<D extends LabelDictionary>(
  dict: D,
  key: string | null | undefined,
  fallback?: string,
): string {
  if (key === null || key === undefined) return fallback ?? "";
  return (dict as Record<string, string>)[key] ?? fallback ?? key;
}
