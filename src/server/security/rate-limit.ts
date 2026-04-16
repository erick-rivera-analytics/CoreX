import { createHash } from "node:crypto";

const buckets = new Map<string, number[]>();

export type RateLimitGate = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

function buildFallbackIdentity(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return "local";
  }

  const fingerprint = createHash("sha256")
    .update([
      request.headers.get("host") ?? "",
      request.headers.get("user-agent") ?? "",
      request.headers.get("accept-language") ?? "",
      request.headers.get("x-forwarded-host") ?? "",
      request.headers.get("x-forwarded-proto") ?? "",
    ].join("|"))
    .digest("hex")
    .slice(0, 24);

  return `fallback-${fingerprint}`;
}

export function getClientIdentity(request: Request, suffix?: string) {
  const rawKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || buildFallbackIdentity(request);
  const clientKey = rawKey.toLowerCase().replace(/[^a-z0-9:._-]/g, "_").slice(0, 96);
  const normalizedSuffix = suffix?.trim().toLowerCase().replace(/[^a-z0-9:._-]/g, "_").slice(0, 96);
  return normalizedSuffix ? `${clientKey}:${normalizedSuffix}` : clientKey;
}

export function getEnvNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const history = (buckets.get(key) ?? []).filter((stamp) => stamp > windowStart);

  if (history.length >= limit) {
    buckets.set(key, history);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((history[0] + windowMs - now) / 1000)),
      remaining: 0,
    };
  }

  history.push(now);
  buckets.set(key, history);
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, limit - history.length),
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function checkRequestRateLimit({
  request,
  scope,
  suffix,
  limit,
  windowMs,
}: {
  request: Request;
  scope: string;
  suffix?: string;
  limit: number;
  windowMs: number;
}) {
  return checkRateLimit(`${scope}:${getClientIdentity(request, suffix)}`, limit, windowMs);
}
