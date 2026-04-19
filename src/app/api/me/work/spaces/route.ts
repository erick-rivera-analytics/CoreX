import { type NextRequest } from "next/server";

import { apiJsonError, handleApiError } from "@/lib/api-error";
import { createSpaceSchema } from "@/lib/personal-workspace-schemas";
import { createMyWorkSpace, listMyWorkSpaces } from "@/lib/my-work-repository";
import { enforcePersonalWriteRateLimit, getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.bootstrap) return context.error;

    const spaces = await listMyWorkSpaces(context.bootstrap.authUserId);
    return jsonNoStore({ spaces });
  } catch (error) {
    return handleApiError(error, "No se pudieron cargar los espacios personales.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.access || !context.bootstrap) return context.error;

    const rateLimitError = enforcePersonalWriteRateLimit(request, context.requestId, context.access.username);
    if (rateLimitError) return rateLimitError;

    const parsed = createSpaceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiJsonError("Datos del espacio invalidos.", 400, context.requestId);
    }

    const space = await createMyWorkSpace(context.bootstrap.authUserId, parsed.data, context.access.username);
    return jsonNoStore({ space }, 201);
  } catch (error) {
    return handleApiError(error, "No se pudo crear el espacio personal.");
  }
}
