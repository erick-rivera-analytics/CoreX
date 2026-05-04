import { redirect } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";

import { canAccessResource, getApiAccessRule } from "@/lib/access-control";
import { getSessionUser } from "@/lib/auth";
import { apiJsonError } from "@/lib/api-error";
import { logEvent } from "@/lib/logger";
import { getRequestId } from "@/lib/request-id";

export async function getCurrentUserAccess() {
  const user = await getSessionUser();

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    username: user.username,
    roleCode: user.roleCode,
    isSuperadmin: user.roleCode === "superadmin",
    allowedResources: user.allowedResources,
    permissionOverrides: user.permissionOverrides,
    isActive: user.isActive,
  };
}

export async function requirePageAccess(resourceKey: string) {
  const access = await getCurrentUserAccess();

  if (!access || !access.isActive) {
    redirect("/login");
  }

  if (!canAccessResource(resourceKey, access.allowedResources, access.isSuperadmin)) {
    redirect("/dashboard");
  }

  return access;
}

export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const requestId = getRequestId(request);
  const originError = validateMutationOrigin(request, requestId);
  if (originError) return originError;

  const access = await getCurrentUserAccess();

  if (!access || !access.isActive) {
    return apiJsonError("Missing authentication token", 401, requestId);
  }

  const rule = getApiAccessRule(request.nextUrl.pathname);
  if (!rule) {
    return apiJsonError("La ruta API solicitada no esta habilitada.", 403, requestId);
  }

  if (rule.policy === "superadmin-only") {
    if (access.isSuperadmin) {
      return null;
    }

    return apiJsonError("Este recurso es solo para superadmin.", 403, requestId);
  }

  if (rule.policy === "internal-dev-only") {
    if (process.env.NODE_ENV === "production") {
      return apiJsonError("Ruta no disponible.", 404, requestId);
    }

    if (access.isSuperadmin) {
      return null;
    }

    return apiJsonError("Este recurso interno es solo para superadmin.", 403, requestId);
  }

  const requiredResources = rule.requiredResources ?? [];
  const canView = requiredResources.some((resourceKey) =>
    canAccessResource(resourceKey, access.allowedResources, access.isSuperadmin),
  );

  if (!canView) {
    return apiJsonError("No tienes acceso a este recurso.", 403, requestId);
  }

  return null;
}

function validateMutationOrigin(request: NextRequest, requestId: string) {
  if (process.env.API_ORIGIN_CHECK_ENABLED !== "true") return null;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return null;

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const hostHeader = request.headers.get("host");
  const xForwardedHost = request.headers.get("x-forwarded-host");
  const xForwardedProto = request.headers.get("x-forwarded-proto");
  const source = originHeader || refererHeader;

  const allowedOrigins = new Set(
    [
      request.nextUrl.origin,
      process.env.APP_ORIGIN,
      ...(process.env.TRUSTED_ORIGINS?.split(",") ?? []),
    ]
      .map((value) => value?.trim())
      .filter(Boolean) as string[],
  );

  function deny(reason: string, sourceOrigin?: string) {
    logEvent("warn", "api.origin.denied", {
      requestId,
      reason,
      method: request.method,
      path: request.nextUrl.pathname,
      sourceOrigin: sourceOrigin ?? source ?? null,
      originHeader,
      refererHeader,
      hostHeader,
      xForwardedHost,
      xForwardedProto,
      requestNextUrlOrigin: request.nextUrl.origin,
      allowedOrigins: Array.from(allowedOrigins),
    });
    return apiJsonError("Origen de solicitud no permitido.", 403, requestId);
  }

  if (!source) {
    return deny("missing_origin_and_referer_header");
  }

  let sourceOrigin: string;
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    return deny("malformed_source_url");
  }

  if (!allowedOrigins.has(sourceOrigin)) {
    return deny("origin_not_in_allowlist", sourceOrigin);
  }

  return null;
}
