import { type NextRequest } from "next/server";

import { handleGeneralSimpleMasterGet, handleGeneralSimpleMasterPost } from "@/lib/general-master-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleGeneralSimpleMasterGet(request, "varieties", "No se pudo cargar el maestro de variedades.");
}

export async function POST(request: NextRequest) {
  return handleGeneralSimpleMasterPost(request, {
    kind: "varieties",
    rateKey: "general-varieties",
    fallbackActorId: "corex_general_masters_ui",
    createErrorMessage: "No se pudo crear la variedad.",
  });
}
