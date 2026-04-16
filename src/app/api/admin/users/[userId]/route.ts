import { NextRequest, NextResponse } from "next/server";

import { isRoleCode, parsePermissionOverridesInput } from "@/lib/access-control";
import { requireAuth } from "@/lib/api-auth";
import { apiJsonError, handleApiError } from "@/lib/api-error";
import { getRequestId } from "@/lib/request-id";
import { deleteUser, getUserById, getUserByUsername, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

function jsonError(message: string, status: number, requestId: string) {
  return apiJsonError(message, status, requestId);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { userId } = await context.params;
    const id = Number.parseInt(userId, 10);
    if (Number.isNaN(id)) {
      return jsonError("ID invalido.", 400, requestId);
    }

    const user = await getUserById(id);
    if (!user) {
      return jsonError("Usuario no encontrado.", 404, requestId);
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error, "No se pudo obtener el usuario.", requestId);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { userId } = await context.params;
    const id = Number.parseInt(userId, 10);
    if (Number.isNaN(id)) {
      return jsonError("ID invalido.", 400, requestId);
    }

    const body = await request.json();
    const { username, password, isActive, roleCode, permissionOverrides } = body;

    if (username !== undefined) {
      if (typeof username !== "string" || username.trim().length < 3) {
        return jsonError("El nombre de usuario debe tener al menos 3 caracteres.", 400, requestId);
      }

      const existing = await getUserByUsername(username.trim().toLowerCase());
      if (existing && existing.id !== id) {
        return jsonError("El nombre de usuario ya existe.", 409, requestId);
      }
    }

    if (password !== undefined && (typeof password !== "string" || password.length < 6)) {
      return jsonError("La contrasena debe tener al menos 6 caracteres.", 400, requestId);
    }

    if (roleCode !== undefined && !isRoleCode(roleCode)) {
      return jsonError("El rol seleccionado no es valido.", 400, requestId);
    }

    const parsedPermissionOverrides =
      permissionOverrides === undefined
        ? undefined
        : parsePermissionOverridesInput(permissionOverrides);

    if (parsedPermissionOverrides === null) {
      return jsonError("Los accesos enviados no son validos.", 400, requestId);
    }

    const user = await updateUser(id, {
      username,
      password,
      isActive,
      roleCode,
      permissionOverrides: parsedPermissionOverrides,
    });

    if (!user) {
      return jsonError("Usuario no encontrado.", 404, requestId);
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar el usuario.", requestId);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request);
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const { userId } = await context.params;
    const id = Number.parseInt(userId, 10);
    if (Number.isNaN(id)) {
      return jsonError("ID invalido.", 400, requestId);
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return jsonError("Usuario no encontrado.", 404, requestId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo eliminar el usuario.", requestId);
  }
}
