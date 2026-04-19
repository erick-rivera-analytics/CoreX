import { type NextRequest } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { getMyWorkSummary } from "@/lib/my-work-repository";
import { getPersonalApiContext, jsonNoStore } from "@/app/api/me/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const context = await getPersonalApiContext(request);
    if (context.error || !context.bootstrap) return context.error;

    const summary = await getMyWorkSummary(
      context.bootstrap.authUserId,
      context.bootstrap.profile.timezoneName,
    );

    return jsonNoStore({ summary });
  } catch (error) {
    return handleApiError(error, "No se pudo cargar el resumen personal.");
  }
}
