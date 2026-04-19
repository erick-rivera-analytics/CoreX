import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { profilePatchSchema } from "@/lib/personal-workspace-schemas";
import { getMyAccountProfile, updateMyAccountProfile } from "@/lib/my-account-repository";
import { enforcePersonalWriteRateLimit, getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.bootstrap) return context.error;

    const profile = await getMyAccountProfile(context.bootstrap.authUserId);
    return jsonNoStore({ profile: profile ?? context.bootstrap.profile });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el perfil personal.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.access || !context.bootstrap) return context.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, context.requestId, context.access.username);
    if (rateLimitError) return rateLimitError;

    const parsed = profilePatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiJsonError("Datos de perfil invalidos.", 400, context.requestId);
    }

    const profile = await updateMyAccountProfile(
      context.bootstrap.authUserId,
      parsed.data,
      context.access.username,
    );

    return jsonNoStore({ profile });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar el perfil personal.");
  }
}
