import { NextRequest, NextResponse } from "next/server";

import { isRoleCode, parsePermissionOverridesInput } from "@/lib/access-control";
import { requireAuth } from "@/lib/api-auth";
import { apiJsonError, handleApiError } from "@/lib/api-error";
import { getRequestId } from "@/lib/request-id";
import { createUser, getUserByUsername, listUsers } from "@/lib/users";
import { checkRequestRateLimit, getEnvNumber } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, requestId: string, headers?: HeadersInit) {
  return apiJsonError(message, status, requestId, headers);
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error, "No se pudo obtener la lista de usuarios.", requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;

  const rl = checkRequestRateLimit({
    request,
    scope: "admin-users",
    limit: getEnvNumber("ADMIN_USERS_RATE_LIMIT", 10),
    windowMs: getEnvNumber("ADMIN_USERS_RATE_LIMIT_WINDOW_MS", 60_000),
  });
  if (!rl.allowed) {
    return jsonError(
      "Demasiados intentos. Intenta nuevamente en un momento.",
      429,
      requestId,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  try {
    const body = await request.json();
    const { username, password, isActive, roleCode, permissionOverrides } = body;

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return jsonError("El nombre de usuario debe tener al menos 3 caracteres.", 400, requestId);
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return jsonError("La contrasena debe tener al menos 6 caracteres.", 400, requestId);
    }

    if (roleCode !== undefined && !isRoleCode(roleCode)) {
      return jsonError("El rol seleccionado no es valido.", 400, requestId);
    }

    const parsedPermissionOverrides = parsePermissionOverridesInput(permissionOverrides);
    if (parsedPermissionOverrides === null) {
      return jsonError("Los accesos enviados no son validos.", 400, requestId);
    }

    const existing = await getUserByUsername(username.trim().toLowerCase());
    if (existing) {
      return jsonError("El nombre de usuario ya existe.", 409, requestId);
    }

    const user = await createUser({
      username,
      password,
      isActive,
      roleCode,
      permissionOverrides: parsedPermissionOverrides,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "No se pudo crear el usuario.", requestId);
  }
}
