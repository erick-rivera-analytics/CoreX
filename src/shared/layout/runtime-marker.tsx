"use client";

/**
 * Marcador runtime visible solo en development.
 *
 * Renderiza un pill discreto en la esquina inferior derecha con el commit
 * hash actual (build time) y la branch. Sirve para verificar de un vistazo
 * que el dev server está compilando el código que crees que está corriendo.
 *
 * Si NO ves este marcador en la web:
 *   - el dev server no levantó este código (otra branch / otra carpeta)
 *   - el cache de Next.js está stale (eliminar `.next/` y reiniciar)
 *   - estás viendo un build de producción donde NEXT_PUBLIC_BUILD_COMMIT no se inyectó
 *
 * Variables de entorno (opcionales, inyectadas en build):
 *   - NEXT_PUBLIC_BUILD_COMMIT: hash corto del commit
 *   - NEXT_PUBLIC_BUILD_BRANCH: nombre de branch
 *   - NEXT_PUBLIC_BUILD_LABEL: etiqueta libre (e.g. "Audit final runtime check")
 *
 * Si las variables no están definidas, el marcador igual aparece con texto
 * literal del fallback para que sepas que el componente sí está renderizado.
 *
 * Producción: este componente no se renderiza si `process.env.NODE_ENV === "production"`
 * a menos que `NEXT_PUBLIC_RUNTIME_MARKER === "force"`.
 */
export function RuntimeMarker() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_RUNTIME_MARKER !== "force") {
    return null;
  }

  const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "dev";
  const branch = process.env.NEXT_PUBLIC_BUILD_BRANCH ?? "local";
  const label = process.env.NEXT_PUBLIC_BUILD_LABEL ?? "Audit final runtime check";

  return (
    <div
      role="status"
      aria-live="off"
      className="pointer-events-none fixed bottom-3 right-3 z-[var(--z-toast)] select-none rounded-full border border-border/70 bg-card/95 px-3 py-1.5 text-[10px] font-medium tracking-[0.04em] text-muted-foreground shadow-[var(--shadow-card)] backdrop-blur"
    >
      <span className="mr-1 inline-block size-1.5 rounded-full bg-chart-success-bold align-middle" aria-hidden="true" />
      {label}: <span className="font-semibold text-foreground">{commit}</span>
      <span className="ml-1 text-muted-foreground/70">/ {branch}</span>
    </div>
  );
}
