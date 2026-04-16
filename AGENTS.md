# AGENTS.md

Guia operativa para agentes que trabajen en este repo.

## Comandos

```bash
npm run dev          # Next.js 16.2.4 con Webpack
npm run build
npm run start
npm run check
npm run canon:check
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run docs:check
npx vitest run src/lib/__tests__/server-cache.test.ts
```

## Arquitectura actual

**Stack:** Next.js 16.2.4, React 19, TypeScript 5.9, Tailwind CSS 4, PostgreSQL via `pg`, SWR en cliente.

### Frontera de capas

```text
src/app -> src/modules -> src/shared + src/lib
```

### Flujo de datos

1. `page.tsx` server valida acceso y carga datos iniciales.
2. El loader server reutiliza helpers de `src/modules/shared/server-page.tsx`.
3. La UI de pantalla vive en `src/modules/*`.
4. `src/components/dashboard/*` queda congelado y reducido a placeholder/chatbot/notas; no es fuente de UI visible.
5. Las APIs llaman `requireAuth()` y quedan protegidas por reglas explicitas en `src/lib/access-control.ts`.

### Fuente de verdad de modulos

`src/config/module-catalog.ts` define:

- ruta
- titulo
- eyebrow
- resumen
- grupo de navegacion
- estado del modulo (`active | hidden | internal`)
- visibilidad movil

Desde ahi se derivan:

- `src/config/sidebar-data.ts`
- `src/config/dashboard.ts`
- recursos RBAC visibles

### Modulos visibles hoy

- Campo
- Fenograma
- Mortandades
- Comparacion
- Productividad
- Programaciones
- Balanzas
- Administrar SKU's
- Clasificacion en blanco
- Talento Humano
- Usuarios

Las rutas placeholder siguen existiendo solo como rutas ocultas; no deben volver a aparecer en navegacion sin funcionalidad real.

## Auth y seguridad

- Cookie `wh-session`, firma HMAC-SHA256, expiracion 24h.
- `SESSION_SECRET` obligatorio en produccion.
- En desarrollo, el secreto se deriva del workspace; ya no se usa un secreto fijo hardcodeado.
- `ALLOW_ENV_ADMIN_BYPASS` sigue limitado a no-produccion.
- Las APIs protegidas usan `deny by default`.
- Las mutaciones protegidas pueden validar `Origin`/`Referer` con `API_ORIGIN_CHECK_ENABLED=true`.
- `/api/health/db` es `superadmin-only`.
- `/api/health/live` es publico y no expone datos sensibles.
- `/api/programaciones/debug` es `internal-dev-only`.

## Convenciones importantes

- No introducir placeholders visibles como si fueran modulos listos.
- Antes de crear UI/helper nuevo, revisar `docs/reuse-index.md`.
- `src/components/dashboard/*` es legacy congelado; no crear crecimiento nuevo ahi.
- `src/lib/fenograma.ts` y `src/lib/postcosecha-balanzas.ts` son fachadas temporales; agrega logica nueva en subarchivos de dominio, no en la fachada.
- Para crear modulos nuevos sigue `docs/extender-modulos.md` de punta a punta.
- Si una pagina nueva nace, debe registrarse primero en `src/config/module-catalog.ts`.
- Si una API nueva usa `requireAuth()`, debe quedar mapeada en `src/lib/access-control.ts`.
- Mantener errores API en shape compatible `{ message, error }`.

## Docs obligatorios

- `docs/reuse-index.md`: que reutilizar antes de inventar.
- `docs/extender-modulos.md`: flujo unico para agregar modulos.
- `docs/ui-canon.md`: canon visual.
- `docs/security-ops.md`: seguridad operacional.
- `docs/testing.md`: pruebas y smoke.
- `docs/definition-of-done.md`: cierre minimo.

## Restricciones

- No agregar `connectionTimeoutMillis` ni `statement_timeout` a `src/lib/db.ts`.
- `next.config.ts` necesita `unsafe-inline`, `unsafe-eval` y `ws:` en CSP para que Next funcione.
- `@/*` apunta a `./src/*`.
