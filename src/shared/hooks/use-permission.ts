"use client";

import { useCurrentUserAccess } from "@/hooks/use-current-user-access";
import { canAccessResource } from "@/lib/access-control";

/**
 * Tipo de acción granular que puede protegerse por recurso.
 *
 * En Audit #1 sólo `canView` está implementado contra el modelo actual.
 * `canWrite`, `canDelete` y `canExport` quedan con valores placeholder
 * (`isSuperadmin || canView`) hasta que la migración del esquema
 * (Audit #3) introduzca columnas dedicadas.
 */
export type PermissionAction = "view" | "write" | "delete" | "export";

export type ResourcePermission = {
  canView: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canExport: boolean;
  isSuperadmin: boolean;
  /** True mientras se está cargando la sesión inicial. */
  isLoading: boolean;
};

/**
 * Hook canónico para resolver permisos de un recurso concreto.
 *
 * @example
 * const { canView, canWrite, isLoading } = usePermission("/dashboard/dead-plants-reseed");
 * if (isLoading) return <Skeleton />;
 * if (!canView) return null;
 *
 * Implementación actual: `canView` se resuelve contra `allowedResources` +
 * `isSuperadmin` del endpoint `/api/auth/me`. `canWrite` / `canDelete` /
 * `canExport` mantienen una resolución placeholder hasta Audit #3.
 *
 * No introducir hardcoded role checks (`role === "superadmin"`) en consumers;
 * usar siempre este hook o `<PermissionGuard>`.
 */
export function usePermission(resourceKey: string): ResourcePermission {
  const { data, isLoading } = useCurrentUserAccess();
  const allowedResources = data?.allowedResources ?? [];
  const isSuperadmin = data?.isSuperadmin ?? false;
  const canView = canAccessResource(resourceKey, allowedResources, isSuperadmin);
  return {
    canView,
    canWrite: isSuperadmin || canView,
    canDelete: isSuperadmin,
    canExport: isSuperadmin || canView,
    isSuperadmin,
    isLoading: isLoading && !data,
  };
}
