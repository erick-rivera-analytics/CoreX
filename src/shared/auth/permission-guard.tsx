"use client";

import type { ReactNode } from "react";

import { usePermission, type PermissionAction } from "@/shared/hooks/use-permission";

/**
 * Guarda canónica para condicionar el render de un componente o subárbol
 * por permisos del usuario sobre un recurso.
 *
 * @example
 * <PermissionGuard resource="/dashboard/dead-plants-reseed" action="write">
 *   <CapturePanel />
 * </PermissionGuard>
 *
 * Acciones soportadas: `view` (default), `write`, `delete`, `export`.
 *
 * Mientras la sesión carga, no renderiza nada (ni children ni fallback) para
 * evitar parpadeos. Una vez resuelta, evalúa `usePermission` y renderiza
 * `children` si se cumple, o `fallback` si está provisto.
 *
 * Importante: ESTA GUARDA ES SOLO UI. Cualquier acción que muta datos debe
 * estar protegida también en el endpoint via `requireAuth` + `access-control`.
 * Adoptar este componente en consumidores existentes es trabajo de Audit #4+.
 */
export function PermissionGuard({
  resource,
  action = "view",
  fallback = null,
  children,
}: {
  resource: string;
  action?: PermissionAction;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const permission = usePermission(resource);
  if (permission.isLoading) return null;
  const allowed =
    action === "view"
      ? permission.canView
      : action === "write"
        ? permission.canWrite
        : action === "delete"
          ? permission.canDelete
          : permission.canExport;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
