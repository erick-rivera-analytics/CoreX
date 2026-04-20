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
- Si no existe IP real en produccion, usar fallback estable derivado de headers seguros; no colapsar todo a `local`.
- Backend actual: memory.
- Variables preparadas: `RATE_LIMIT_BACKEND`, `REDIS_URL`.
- Scopes activos por modulo:
  - `auth:login` (`AUTH_LOGIN_USER_RATE_LIMIT` / `AUTH_LOGIN_IP_RATE_LIMIT`).
  - `admin:users` (`ADMIN_USERS_RATE_LIMIT`).
  - `dead-plants-reseed:write` (`DEAD_PLANTS_RESEED_RATE_LIMIT` / `DEAD_PLANTS_RESEED_RATE_LIMIT_WINDOW_MS`) para `POST /api/dead-plants-reseed/capture` y `PATCH /api/dead-plants-reseed/records`.
  - `chat` (`CHAT_RATE_LIMIT`).

## Logging

Usar `src/lib/logger.ts`.

No loguear tokens, cookies, passwords, secretos ni payloads completos.

## Health

- `/api/health/live`: publico, sin datos sensibles, para Docker/monitoreo.
- `/api/health/db`: protegido, solo superadmin.

## Panel permissions (sub-permisos intra-pagina)

Ademas de los resourceKeys por ruta (`/dashboard/*`), el RBAC soporta recursos virtuales con prefijo `panel:<dominio>.<subseccion>`. Sirven para bloquear sub-secciones dentro de un overlay/sheet sin fragmentar rutas.

Registro actual (`src/lib/access-control.ts`, `PANEL_ACCESS_RESOURCES`):

- `panel:person-sheet.info` - Ficha del personal > Informacion
- `panel:person-sheet.performance` - Ficha del personal > Rendimiento
- `panel:person-sheet.medical` - Ficha del personal > Ficha medica (gatea tambien `/api/medical/person/*`)

Flujo para agregar uno nuevo:

1. Agregar entrada en `PANEL_ACCESS_RESOURCES` con `section: "Paneles"`.
2. En el UI: `useCurrentUserAccess()` + `canAccessResource("panel:...", allowed, isSuperadmin)` y ocultar el tab/panel si false.
3. Si existe API asociada: agregar regla en `API_ACCESS_RULES` con `requiredResources: ["panel:..."]`.
4. La UI de Admin > Usuarios los lista automaticamente bajo la seccion "Paneles".

Viewers heredan todos los paneles por defecto (opt-out); el admin los bloquea por usuario.

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
