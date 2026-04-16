# Security Ops

## Auth

- Cookie: `wh-session`.
- Firma: HMAC-SHA256.
- Expiracion: 24h.
- `SESSION_SECRET` obligatorio en produccion.
- `SESSION_SECRET_PREVIOUS` permite rotacion temporal sin expulsar sesiones validas.
- `ALLOW_ENV_ADMIN_BYPASS` solo funciona fuera de produccion.

## RBAC

- Paginas: `requirePageAccess(resourceKey)`.
- APIs: `requireAuth(request)` + regla en `src/lib/access-control.ts`.
- Modelo: deny by default.
- `/api/health/db`: `superadmin-only`.
- `/api/programaciones/debug`: `internal-dev-only`.

## Origin checks

`API_ORIGIN_CHECK_ENABLED=true` valida `Origin` o `Referer` en `POST`, `PUT`, `PATCH`, `DELETE` protegidos por cookie.

Origenes permitidos:

- `request.nextUrl.origin`;
- `APP_ORIGIN`;
- `TRUSTED_ORIGINS` separado por comas.

## Rate limit

Usar `src/server/security/rate-limit.ts`.

- Identidad canonica: IP real via `x-forwarded-for`/`x-real-ip` + sufijo opcional.
- Backend actual: memory.
- Variables preparadas: `RATE_LIMIT_BACKEND`, `REDIS_URL`.

## Logging

Usar `src/lib/logger.ts`.

No loguear tokens, cookies, passwords, secretos ni payloads completos.

## Health

- `/api/health/live`: publico, sin datos sensibles, para Docker/monitoreo.
- `/api/health/db`: protegido, solo superadmin.

## Variables criticas

- `SESSION_SECRET`
- `SESSION_SECRET_PREVIOUS`
- `COOKIE_SECURE`
- `APP_ORIGIN`
- `TRUSTED_ORIGINS`
- `API_ORIGIN_CHECK_ENABLED`
- `LOG_LEVEL`
- `LOG_FORMAT`
- `CHAT_ENABLED`
- `CHAT_RATE_LIMIT`
