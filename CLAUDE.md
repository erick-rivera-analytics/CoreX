# CLAUDE.md

Guia operativa principal del repo.

## Comandos

```bash
npm run dev          # Next.js 16.2.4 con Webpack
npm run build
npm run start
npm run check
npm run canon:check
npm run docs:check
npm run typecheck
npm run lint
npm run test
npx vitest run src/lib/__tests__/server-cache.test.ts
```

Pipeline geoespacial:

```bash
npm run canon:v2:stage
npm run canon:v2:rasters
npm run canon:v2:vectors
npm run canon:v2:manifest
npm run canon:v2:build
```

## Stack

- Next.js 16.2.4 App Router
- React 19
- TypeScript 5.9
- Tailwind CSS 4
- PostgreSQL via `pg`
- SWR
- shadcn/ui compatible primitives en `src/shared/ui`

## Frontera de arquitectura

```text
src/app -> src/modules -> src/shared + src/lib
```

- `src/app`: rutas, layouts, acceso server-side y bootstrap inicial.
- `src/modules`: superficie estable por modulo.
- `src/shared`: piezas reutilizables de layout, UI, filtros, charts, tablas y overlays.
- `src/lib`: queries, auth, RBAC, cache y acceso a infraestructura.

## Fuente de verdad de modulos

`src/config/module-catalog.ts` es la fuente de verdad para metadatos de pagina, visibilidad, navegacion, home, mobile nav y recursos RBAC visibles.

Estados soportados:

- `active`
- `hidden`
- `internal`

Derivados principales:

- `src/config/sidebar-data.ts`
- `src/config/dashboard.ts`
- `src/lib/access-control.ts`

## Modulos visibles hoy

Dashboard / Indicadores:

- Campo
- Fenograma
- Mortandades
- Comparacion
- Productividad
- Balanzas
- Composicion laboral
- Demografia personal
- Rotacion laboral

Gestion:

- Programaciones
- Administrar SKU's
- Clasificacion en blanco

Administracion:

- Usuarios

Rutas ocultas:

- `/dashboard/postcosecha/registros`
- `/dashboard/postcosecha/planificacion/programaciones`
- `/dashboard/postcosecha/planificacion/plan-de-trabajo`

## Data flow

1. `page.tsx` valida acceso con `requirePageAccess()` directa o indirectamente via `loadProtectedPageData()`.
2. El loader server usa `src/modules/shared/server-page.tsx`.
3. La UI del modulo entra por `src/modules/*`.
4. Los explorers en `src/components/dashboard/*` son legacy/transicionales.
5. SWR revalida contra `src/app/api/*`.
6. Las APIs llaman `src/lib/*` y responden JSON normalizado.

## Auth y seguridad

- Sesion por cookie `wh-session`.
- Firma HMAC-SHA256.
- Expiracion 24h.
- Login por `username + password`.
- `SESSION_SECRET` obligatorio en produccion.
- En desarrollo, el secreto se deriva del workspace y no usa un valor fijo global.

RBAC:

- roles: `superadmin`, `viewer`, `custom`
- permisos por recurso de pagina
- paginas protegidas por `requirePageAccess(resourceKey)`
- APIs protegidas por `requireAuth(request)`
- modelo API: `deny by default`

Politicas API:

- `resource-bound`
- `superadmin-only`
- `internal-dev-only`

Casos importantes:

- `/api/health/db` => `superadmin-only`
- `/api/health/live` => publico, sin datos sensibles
- `/api/programaciones/debug` => `internal-dev-only`
- mutaciones protegidas => origin/referer check si `API_ORIGIN_CHECK_ENABLED=true`
- errores API => `{ message, error }`; helpers nuevos agregan `requestId`

## Docs anti-invencion

- `docs/reuse-index.md`: buscar aqui antes de crear componentes/helpers.
- `docs/extender-modulos.md`: flujo unico catalogo -> page server -> loader -> UI -> API rule -> tests -> QA.
- `docs/ui-canon.md`: reglas visuales y excepciones.
- `docs/security-ops.md`: auth, RBAC, rate limit, health, logging y env.
- `docs/testing.md`: estrategia de tests sin DB real y smoke manual.
- `docs/definition-of-done.md`: checklist de cierre.
- `docs/module-contracts.md`: contratos de page, API, UI y datos.

## UI Canon para Explorers

Estructura estandar para nuevos explorers en `src/modules/*/components/`:

```tsx
<div className="space-y-4">
  <SectionPageShell eyebrow="..." title="..." subtitle="...">
    <FilterPanel>
      {/* MultiSelectField, SingleSelectField, DateField, WeekField, ToggleChipGroup */}
      <KpiGrid>
        {/* MetricTile items */}
      </KpiGrid>
    </FilterPanel>
  </SectionPageShell>

  {data.length === 0 ? <EmptyState /> : (
    <>
      <ChartSection>
        <ChartSurface title="...">{/* Chart */}</ChartSurface>
      </ChartSection>
      <DetailSection>{/* Card > ScrollFadeTable */}</DetailSection>
    </>
  )}
</div>
```

Componentes compartidos obligatorios:

- `SectionPageShell` from `@/shared/layout/section-page-shell`
- `FilterPanel`, `KpiGrid`, `ChartSection`, `DetailSection` from `@/shared/layout/filter-panel`
- `MetricTile` from `@/shared/data-display/metric-tile`
- `ChartSurface`, `EmptyState` from `@/shared/data-display/*`
- `ChartTooltip`, `RechartsTooltipAdapter`, `axisConfig`, `axisTickStyle`, `gridConfig` from `@/shared/charts/*`
- `DateField`, `WeekField`, `ToggleChipGroup`, `MultiSelectField`, `SingleSelectField` from `@/shared/filters/*`
- `DialogShell`, `SheetShell` from `@/shared/overlays/*`
- `SortableHeader`, `ScrollFadeTable`, `StandardTable` from `@/shared/tables/*`
- Formatters from `@/shared/lib/format`: `formatInteger`, `formatDecimal`, `formatFlexibleNumber`, `formatPercent`, `formatHours`, `formatDate`, `formatDateSlash`, `formatDateTime`

Reglas visuales obligatorias:

- Filtros arriba de KPIs, ambos dentro de `FilterPanel`.
- KPIs siempre con `MetricTile`; no crear `MetricPill` o `SummaryPill` nuevos.
- Charts Recharts siempre con `ChartTooltip`/`RechartsTooltipAdapter` y axis config compartido.
- Overlays nuevos siempre con `DialogShell` o `SheetShell`; no crear z-index custom.
- Colores de charts nuevos via CSS custom properties, no hex/rgb inline.
- Superficies tipo panel usan tokens `var(--shadow-*)`; `.starter-panel` consume `--shadow-panel` y tooltips consumen `--shadow-tooltip`.

Excepciones documentadas:

- `campo-map.tsx` conserva colores directos porque Leaflet necesita valores concretos para `L.PathOptions`.
- Programaciones usa paletas categoricas literales centralizadas en `src/config/programaciones-palettes.ts`.
- Comparacion no requiere `KpiGrid`; su layout de batalla es el contenido principal.
- `fenograma-block-modal.tsx` conserva `MetricPill` local porque es clickeable y de dominio.
- `person-detail-sheet.tsx` puede usar `space-y-6` dentro del overlay para respiracion visual.

## Restricciones

- No agregar `connectionTimeoutMillis` ni `statement_timeout` a `src/lib/db.ts`.
- `next.config.ts` necesita `unsafe-inline`, `unsafe-eval` y `ws:` en CSP.
- El dev server usa `--webpack`.
- Toda API protegida nueva debe registrarse en `src/lib/access-control.ts`.
- Todo modulo nuevo debe registrarse primero en `src/config/module-catalog.ts`.
- Todo formatter numerico nuevo debe usar `@/shared/lib/format.ts`.
- No crear explorers nuevos en `src/components/dashboard/`.

## Deuda arquitectonica conocida

- `src/components/dashboard/` sigue siendo legacy/transicional. No crear archivos nuevos alli.
- Varias entradas de `src/modules/*` todavia importan explorers legacy desde `src/components/dashboard/*`.
- `fenograma-block-modal.tsx` sigue siendo un componente masivo y debe partirse por subdominios antes de crecer mas.
- `postcosecha-clasificacion-en-blanco-explorer.tsx` aun tiene headers/cards legacy y debe migrar a `SectionPageShell`.
- El canon UX/UI de explorers principales queda cerrado; nuevas divergencias deben documentarse como excepcion antes de crecer.
- El build puede emitir warning de Turbopack/NFT por rutas dinamicas del solver de postcosecha; mantenerlo vigilado.

## Variables de entorno

DB:

- `DATABASE_URL`
- o `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`

Opcionales:

- `DATABASE_POOL_MAX`
- `DATABASE_IDLE_TIMEOUT_MS`
- `SLOW_QUERY_THRESHOLD_MS`
- `DATABASE_SSL`
- `DATABASE_SSL_REJECT_UNAUTHORIZED`

Postcosecha:

- `POSTHARVEST_DATABASE_NAME`
- `POSTHARVEST_AUTO_SEED`
- `POSTHARVEST_SOLVER_PYTHON`
- `POSTHARVEST_SOLVER_ROOT`

Auth:

- `SESSION_SECRET`
- `SESSION_SECRET_PREVIOUS`
- `AUTH_MIN_SESSION_SECRET_LENGTH`
- `COOKIE_SECURE`
- `APP_ORIGIN`
- `TRUSTED_ORIGINS`
- `API_ORIGIN_CHECK_ENABLED`
- `LOG_LEVEL`
- `LOG_FORMAT`
- `ALLOW_ENV_ADMIN_BYPASS`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Chat:

- `GROQ_API_KEY`
- `CHAT_ENABLED`
- `CHAT_MAX_MESSAGES`
- `CHAT_MAX_MESSAGE_CHARS`
- `CHAT_MAX_CONTEXT_BYTES`
- `CHAT_RATE_LIMIT`
- `CHAT_RATE_LIMIT_WINDOW_MS`
