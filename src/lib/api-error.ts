import { NextResponse } from "next/server";

import { logEvent } from "@/lib/logger";
import { createRequestId } from "@/lib/request-id";

export function apiJsonError(message: string, status: number, requestId = createRequestId(), headers?: HeadersInit) {
  return NextResponse.json({ message, error: message, requestId }, { status, headers });
}

export function handleApiError(error: unknown, fallbackMessage: string, requestId = createRequestId()) {
  logEvent("error", "api.error", {
    requestId,
    fallbackMessage,
    error: error instanceof Error ? error.message : String(error),
  });
  const message = process.env.NODE_ENV === "production" ? fallbackMessage : error instanceof Error ? error.message : fallbackMessage;
  return apiJsonError(message, 500, requestId);
}
