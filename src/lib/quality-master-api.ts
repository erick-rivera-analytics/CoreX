import { type NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { formatZodIssue } from "@/lib/admin-masters-schemas";
import {
  createQualityClaimProblem,
  createQualitySimpleMasterRecord,
  listCurrentQualityClaimProblems,
  listCurrentQualitySimpleMasterRecords,
  updateQualityClaimProblem,
  updateQualitySimpleMasterRecord,
} from "@/lib/quality-masters";
import type {
  QualityClaimProblemPayload,
  QualitySimpleMasterKind,
  QualitySimpleMasterPayload,
} from "@/lib/quality-master-types";
import {
  qualityClaimProblemInputSchema,
  qualitySimpleMasterInputSchema,
} from "@/lib/quality-schemas";
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

export async function handleQualitySimpleMasterGet(
  request: NextRequest,
  kind: QualitySimpleMasterKind,
  loadErrorMessage: string,
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const data = await listCurrentQualitySimpleMasterRecords(kind);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, loadErrorMessage);
  }
}

export async function handleQualitySimpleMasterPost(
  request: NextRequest,
  {
    kind,
    rateKey,
    fallbackActorId,
    createErrorMessage,
  }: {
    kind: QualitySimpleMasterKind;
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
    const data = await createQualitySimpleMasterRecord(kind, parsed.data, actorId);

    return NextResponse.json<QualitySimpleMasterPayload>(
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

export async function handleQualitySimpleMasterPatch(
  request: NextRequest,
  entityId: string,
  {
    kind,
    fallbackActorId,
    updateErrorMessage,
  }: {
    kind: QualitySimpleMasterKind;
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
    const data = await updateQualitySimpleMasterRecord(kind, decodeURIComponent(entityId), parsed.data, actorId);

    return NextResponse.json<QualitySimpleMasterPayload>(
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

export async function handleQualityClaimProblemGet(
  request: NextRequest,
  loadErrorMessage: string,
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const data = await listCurrentQualityClaimProblems();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, loadErrorMessage);
  }
}

export async function handleQualityClaimProblemPost(
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
    const parsed = qualityClaimProblemInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(formatZodIssue(parsed.error.issues), 400);
    }

    const actorId = await readActorId(fallbackActorId);
    const data = await createQualityClaimProblem(parsed.data, actorId);

    return NextResponse.json<QualityClaimProblemPayload>(
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

export async function handleQualityClaimProblemPatch(
  request: NextRequest,
  problemId: string,
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
    const parsed = qualityClaimProblemInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(formatZodIssue(parsed.error.issues), 400);
    }

    const actorId = await readActorId(fallbackActorId);
    const data = await updateQualityClaimProblem(decodeURIComponent(problemId), parsed.data, actorId);

    return NextResponse.json<QualityClaimProblemPayload>(
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
