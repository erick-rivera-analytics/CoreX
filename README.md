# CoreX

Dashboard interno en `Next.js 16` para operacion agricola, postcosecha, talento humano y administracion.

## Estado real

El sistema ya no es una plantilla. Hoy tiene:

- autenticacion real con cookie `wh-session`
- RBAC por recurso para paginas y APIs
- conexion real a PostgreSQL
- navegacion y home derivadas desde un catalogo central de modulos
- dashboards operativos en campo, postcosecha, talento humano y seguridad

### Modulos activos

- `/dashboard/campo`
- `/dashboard/fenograma`
- `/dashboard/mortality`
- `/dashboard/comparacion`
- `/dashboard/productividad`
- `/dashboard/programaciones`
- `/dashboard/postcosecha/balanzas`
- `/dashboard/postcosecha/administrar-maestros/skus`
- `/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco`
- `/dashboard/talento-humano/composicion-laboral`
- `/dashboard/talento-humano/demografia-personal`
- `/dashboard/talento-humano/rotacion-laboral`
- `/dashboard/admin/seguridad/usuarios`

### Rutas ocultas

Existen rutas reservadas que siguen en el arbol del proyecto, pero ya no aparecen en navegacion ni home hasta estar listas:

- `/dashboard/postcosecha/registros`
- `/dashboard/postcosecha/planificacion/programaciones`
- `/dashboard/postcosecha/planificacion/plan-de-trabajo`

## Comandos

```bash
npm install
npm run dev
npm run build
npm run start
npm run check
npm run canon:check
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run e2e:smoke
```

El servidor de desarrollo usa `next dev --webpack`.

## Variables de entorno

La base soporta dos modos:

### Opcion A

```env
DATABASE_URL=postgresql://usuario:clave@host:5432/base
```

### Opcion B

```env
DATABASE_HOST=host
DATABASE_PORT=5432
DATABASE_NAME=base
DATABASE_USER=usuario
DATABASE_PASSWORD=clave
```

Variables importantes adicionales:

- `SESSION_SECRET` obligatorio en produccion
- `SESSION_SECRET_PREVIOUS` para rotacion temporal de sesiones
- `COOKIE_SECURE`
- `APP_ORIGIN`
- `TRUSTED_ORIGINS`
- `API_ORIGIN_CHECK_ENABLED`
- `LOG_LEVEL`
- `LOG_FORMAT`
- `GROQ_API_KEY` para el chatbot contextual
- `CHAT_ENABLED`
- `DATABASE_POOL_MAX`
- `DATABASE_IDLE_TIMEOUT_MS`
- `SLOW_QUERY_THRESHOLD_MS`

## Arquitectura corta

La frontera actual del proyecto es:

```text
src/app -> src/modules -> src/shared + src/lib
```

Piezas importantes:

- `src/config/module-catalog.ts`: fuente de verdad de modulos, visibilidad y metadatos
- `src/config/sidebar-data.ts`: sidebar derivado desde el catalogo
- `src/config/dashboard.ts`: contexto de pagina, home y mobile nav derivados desde el catalogo
- `src/lib/access-control.ts`: recursos RBAC y reglas API explicitas
- `src/lib/api-auth.ts`: `requirePageAccess()` y `requireAuth()`
- `src/modules/core/server-page.tsx`: helper comun para loaders server-side

Estado estructural actual:

- la UI visible vive en `src/modules/*`
- `src/components/dashboard/*` queda congelado y reducido a `module-placeholder.tsx`
- `src/lib/fenograma.ts` y `src/lib/postcosecha-balanzas.ts` son fachadas temporales; la logica pesada vive en `*-core.ts` y debe seguir partiendose por dominio
- el solver de clasificacion en blanco y Talento Humano ya estan divididos en piezas de modulo pequeñas

## Seguridad operativa

- Las paginas `/dashboard/*` requieren sesion valida.
- Las APIs con `requireAuth()` usan reglas explicitas y `deny by default`.
- Las mutaciones pueden validar `Origin`/`Referer` con `API_ORIGIN_CHECK_ENABLED=true`.
- `/api/health/db` es solo `superadmin`.
- `/api/health/live` es publico y no expone datos sensibles.
- `/api/programaciones/debug` es interno y no se expone en produccion.
- Los errores API se normalizan a `{ message, error }`; rutas modernizadas incluyen `requestId`.

## Referencias

- Regla corta: si vas a crear algo nuevo, primero demuestra por que no sirve lo existente en `docs/reuse-index.md`.
- `src/components/dashboard/*` es legacy congelado; crecimiento nuevo va en `src/modules/*`.
- Para crear o extender modulos usa `docs/extender-modulos.md`; no inventes shell, fetchers, filtros, KPIs, tablas ni formatters si existen en `docs/reuse-index.md`.
- `docs/reuse-index.md`: indice obligatorio antes de crear componentes o helpers
- `docs/extender-modulos.md`: flujo canonico para agregar pantallas y APIs
- `docs/ui-canon.md`: reglas visuales y excepciones UX/UI
- `docs/security-ops.md`: auth, RBAC, health, origin checks, rate limit y logging
- `docs/testing.md`: tests obligatorios y smoke manual
- `docs/definition-of-done.md`: criterios de cierre
- `CLAUDE.md`: guia operativa resumida
- `AGENTS.md`: guia para agentes/coding assistants
- `docs/arquitectura.md`: referencia historica de arquitectura actual
- `CHATBOT_SETUP.md`: estado real del chatbot contextual
