import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { validateCredentials, setSessionCookie } from "@/lib/auth";
import { checkRequestRateLimit, getClientIdentity, getEnvNumber, resetRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(1000),
});

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isRateLimitEnabled() {
  return process.env.AUTH_RATE_LIMIT_ENABLED !== "false";
}

function isLoginDebugEnabled() {
  return process.env.AUTH_LOGIN_DEBUG === "true";
}

function logLogin(event: string, details: Record<string, unknown>) {
  if (!isLoginDebugEnabled()) return;
  console.info("[AUTH_LOGIN]", event, details);
}

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { message, error: message },
    { status, headers },
  );
}

export async function POST(req: Request) {
  const clientKey = getClientIdentity(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const message = "Datos de inicio de sesion invalidos.";
    logLogin("invalid-json", { clientKey });
    return jsonError(message, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const message = "Datos de inicio de sesion invalidos.";
    logLogin("invalid-payload", { clientKey });
    return jsonError(message, 400);
  }

  const { username, password } = parsed.data;
  const normalizedUsername = normalizeUsername(username);
  const userRateKey = `login:${getClientIdentity(req, normalizedUsername)}`;

  if (isRateLimitEnabled()) {
    const ipLimit = getEnvNumber("AUTH_LOGIN_IP_RATE_LIMIT", 80);
    const userLimit = getEnvNumber("AUTH_LOGIN_USER_RATE_LIMIT", 8);
    const windowMs = getEnvNumber("AUTH_LOGIN_RATE_LIMIT_WINDOW_MS", 60_000);
    const ipGate = checkRequestRateLimit({ request: req, scope: "login-ip", limit: ipLimit, windowMs });
    const userGate = checkRequestRateLimit({ request: req, scope: "login", suffix: normalizedUsername, limit: userLimit, windowMs });

    if (!ipGate.allowed || !userGate.allowed) {
      const retryAfterSeconds = Math.max(ipGate.retryAfterSeconds, userGate.retryAfterSeconds);
      const message = "Demasiados intentos de inicio de sesion. Intenta nuevamente en un momento.";
      logLogin("rate-limited", {
        clientKey,
        username: normalizedUsername,
        ipRemaining: ipGate.remaining,
        userRemaining: userGate.remaining,
        retryAfterSeconds,
      });
      return jsonError(message, 429, { "Retry-After": String(retryAfterSeconds) });
    }
  }

  logLogin("attempt", { clientKey, username: normalizedUsername });
  const isValid = await validateCredentials(username, password);
  logLogin("validated", { clientKey, username: normalizedUsername, isValid });

  if (!isValid) {
    const message = "Credenciales incorrectas";
    return jsonError(message, 401);
  }

  await setSessionCookie(username);
  resetRateLimit(userRateKey);
  logLogin("session-set", { clientKey, username: normalizedUsername });
  return NextResponse.json({ ok: true });
}
