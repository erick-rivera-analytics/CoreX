import { type NextRequest, NextResponse } from "next/server";

import { formatZodIssue } from "@/lib/admin-masters-schemas";
import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import type { PostharvestDestinationPayload } from "@/lib/postcosecha-destination-types";
import {
  createPostharvestDestination,
  listCurrentPostharvestDestinations,
  updatePostharvestDestination,
} from "@/lib/postcosecha-destinos";
import { qualitySimpleMasterInputSchema } from "@/lib/quality-schemas";
import { checkRateLimit } from "@/server/security/rate-limit";

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ message, error: message }, { status, headers });
}

async function readActorId(fallbackActorId: string) {
  return (await getSession()) ?? fallbackActorId;
}

function readRequesterIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

export async function handlePostharvestDestinationGet(
  request: NextRequest,
  loadErrorMessage: string,
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const data = await listCurrentPostharvestDestinations();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, loadErrorMessage);
  }
}

export async function handlePostharvestDestinationPost(
  request: NextRequest,
  {
    rateKey,
    fallbackActorId,
    createErrorMessage,
  }: {
    rateKey: string;
    fallbackActorId: string;
    createErrorMessage: string;
  },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const rl = checkRateLimit(`${rateKey}:${readRequesterIp(request)}`, 20, 60_000);
  if (!rl.allowed) {
    return jsonError(
      "Demasiados intentos. Intenta nuevamente en un momento.",
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  try {
    const raw = await request.json().catch(() => null);
    const parsed = qualitySimpleMasterInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(formatZodIssue(parsed.error.issues), 400);
    }

    const actorId = await readActorId(fallbackActorId);
    const data = await createPostharvestDestination(parsed.data, actorId);

    return NextResponse.json<PostharvestDestinationPayload>(
      { data: data! },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }

    return handleApiError(error, createErrorMessage);
  }
}

export async function handlePostharvestDestinationPatch(
  request: NextRequest,
  entityId: string,
  {
    fallbackActorId,
    updateErrorMessage,
  }: {
    fallbackActorId: string;
    updateErrorMessage: string;
  },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const raw = await request.json().catch(() => null);
    const parsed = qualitySimpleMasterInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(formatZodIssue(parsed.error.issues), 400);
    }

    const actorId = await readActorId(fallbackActorId);
    const data = await updatePostharvestDestination(decodeURIComponent(entityId), parsed.data, actorId);

    return NextResponse.json<PostharvestDestinationPayload>(
      { data: data! },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }

    return handleApiError(error, updateErrorMessage);
  }
}
