import { NextResponse } from "next/server";

import { getCurrentUserAccess } from "@/lib/api-auth";
import { apiJsonError, handleApiError } from "@/lib/api-error";
import { getRequestId } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * Returns the current authenticated user's username.
 * Returns 401 if not authenticated.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const access = await getCurrentUserAccess();

    if (!access) {
      return apiJsonError("Not authenticated", 401, requestId);
    }

    return NextResponse.json({
      ok: true,
      userId: access.userId,
      username: access.username,
      roleCode: access.roleCode,
      isSuperadmin: access.isSuperadmin,
      allowedResources: access.allowedResources,
      permissionOverrides: access.permissionOverrides,
      authenticatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "Failed to get session", requestId);
  }
}
