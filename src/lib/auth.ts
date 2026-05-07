import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";

import { getBaseAllowedResources } from "@/lib/access-control";
import { logEvent } from "@/lib/logger";
import { resolvePreviousSessionSecret, resolveSessionSecret } from "@/lib/session-secret";
import { getUserByUsername, type User } from "@/lib/users";
import { query } from "./db";

const COOKIE_NAME = "wh-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const allowEnvAdminBypass = process.env.ALLOW_ENV_ADMIN_BYPASS === "true" && process.env.NODE_ENV !== "production";

function hasEnvAdminCredentials() {
  return allowEnvAdminBypass && Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}

export async function validateCredentials(username: string, password: string): Promise<boolean> {
  const normalizedUsername = username.trim().toLowerCase();

  if (
    hasEnvAdminCredentials()
    && normalizedUsername === process.env.ADMIN_USERNAME?.trim().toLowerCase()
    && password === process.env.ADMIN_PASSWORD
  ) {
    return true;
  }

  try {
    const result = await query<{ password_hash: string; is_active: boolean }>(
      "SELECT password_hash, is_active FROM public.users WHERE username = $1 LIMIT 1",
      [normalizedUsername],
    );

    if (result.rows.length === 0) return false;

    const user = result.rows[0];
    if (!user.is_active) return false;

    return await bcrypt.compare(password, user.password_hash);
  } catch (error) {
    logEvent("error", "auth.validation_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function createToken(username: string): string {
  const secret = resolveSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    sub: username.trim().toLowerCase(),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
    v: 2,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest();
  return `${encoded}.${sig.toString("base64url")}`;
}

export function verifyToken(token: string): string | null {
  try {
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;

    const providedSig = Buffer.from(sig, "base64url");
    const secrets = [resolveSessionSecret(), resolvePreviousSessionSecret()].filter(Boolean) as string[];
    const validSignature = secrets.some((secret) => {
      const expectedSig = crypto.createHmac("sha256", secret).update(encoded).digest();
      return providedSig.length === expectedSig.length && crypto.timingSafeEqual(providedSig, expectedSig);
    });
    if (!validSignature) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (!payload?.sub || typeof payload.sub !== "string") return null;
    if (typeof payload.exp === "number" && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function setSessionCookie(username: string) {
  const token = createToken(username);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: resolveCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

function resolveCookieSecure() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionUser(): Promise<User | null> {
  const username = await getSession();
  if (!username) return null;

  const user = await getUserByUsername(username);
  if (user) return user;

  if (hasEnvAdminCredentials() && username === process.env.ADMIN_USERNAME?.trim().toLowerCase()) {
    return {
      id: 0,
      username,
      isActive: true,
      roleCode: "superadmin",
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      allowedResources: getBaseAllowedResources("superadmin"),
      permissionOverrides: [],
    };
  }

  return null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
