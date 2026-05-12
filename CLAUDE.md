# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Guia operativa principal del repo. Trabajo siempre en `main` directamente, sin worktrees ni branches paralelas.

## Comandos

```bash
npm run dev          # Next.js 16.2.4 con Webpack (--webpack es obligatorio)
npm run build        # next build --webpack (Turbopack está bloqueado para builds de prod)
npm run start
npm run check        # typecheck + lint + test + canon + legacy + build
npm run canon:check  # invoca check-canon.mjs + docs:check
npm run docs:check
npm run legacy:check
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npx vitest run src/lib/__tests__/server-cache.test.ts   # un solo archivo
npm run e2e:smoke    # opt-in (requiere @playwright/test + envs E2E_*)
```

Pipeline geoespacial (correr antes de tocar Campo si cambian shapes/raster):

```bash
npm run canon:v2:stage
npm run canon:v2:rasters
npm run canon:v2:vectors
npm run canon:v2:manifest
npm run canon:v2:build
```

## Stack

- Next.js 16.2.4 App Router, React 19, TypeScript 5.9
- Tailwind CSS 4
- PostgreSQL via `pg` (8 pools satélite — ver más abajo)
- SWR (revalidación en cliente)
- bpmn-js 18 + diagram-js-minimap 5 (Balanzas process map)
- shadcn/ui-compatible primitives en `src/shared/ui`
- pdflatex como motor de PDF institucional (sin Python+reportlab)

## Frontera de arquitectura

```text
src/app -> src/modules -> src/shared + src/lib
```

- `src/app`: rutas, layouts, acceso server-side y bootstrap inicial.
- `src/modules`: superficie estable por módulo.
- `src/shared`: piezas reutilizables de layout, UI, filtros, charts, tablas y overlays.
- `src/lib`: queries, auth, RBAC, cache y acceso a infraestructura.

`src/lib/*` no puede importar React UI. `src/shared/*` no puede importar `@/modules/*` (excepto `person-profile-dialog.tsx` documentado como excepción de orquestación cross-módulo).

## Fuente de verdad de módulos

`src/config/module-catalog.ts` es la fuente única para metadatos de página, visibilidad, navegación, home, mobile nav y recursos RBAC visibles. **Cualquier módulo nuevo debe nacer aquí primero.**

Estados soportados:

- `active`
- `hidden`
- `internal`

Derivados principales:

- `src/config/sidebar-data.ts`
- `src/config/dashboard.ts`
- `src/lib/access-control.ts`

## Canon de navegación

`docs/navigation-canon.md` es el contrato vigente. Macrosecciones visibles:

```text
CoreX
├─ Inicio          (centro de navegación: catálogo, búsqueda, accesos rápidos, recientes)
├─ Analítica       (KPI, indicadores, tableros)
├─ Gestión         (operación: registros, planificación, ejecución)
└─ Administración  (maestros globales, maestros por dominio, seguridad)
```

Reglas:

- **Las rutas existentes están congeladas** como contrato estable (resourceKey, bookmarks, refresh directo). No se renombran ni eliminan.
- **Módulos nuevos** deben adoptar la jerarquía canon: `Analítica/Dominio/Indicadores & KPI/Vista`, `Gestión/Dominio/Proceso/Módulo`, `Administración/Alcance/Dominio/Maestro`.
- Inicio es navegación derivada del catálogo, no listas paralelas.

`navigationGroup` interno hoy: `Dashboard` (12), `Gestion` (7), `Administracion` (17), `Personal` (2).

## Módulos visibles

Analítica:

- Campo: Mapa, Fenograma, Mortalidad, Comparación, Productividad
- Postcosecha: Balanzas
- Calidad: Punto de apertura
- Talento Humano: Composición laboral, Demografía del personal, Rotación laboral, **Desvinculación personal**, Indicador Seguimientos
- Talento Humano (Explorador): Colaboradores, **Simulador de Vacaciones**, **Herramienta de Desvinculación**

Gestión:

- Programaciones (Campo)
- Drench Program (Campo)
- Recetas y Tipos de elaboración (Laboratorio)
- Programaciones Drench (Bodega)
- SKU's (Postcosecha)
- Solver Clasificación en blanco (Postcosecha)
- Seguimientos Trabajo Social (Talento Humano)

Administración:

- Maestros globales: Catálogos, Dominios, Unidades, Métricas, Metas y objetivos
- Maestros por dominio: Bodega (productos, unidades, categorías, presentaciones), Talento Humano (catálogos, dominios)
- Seguridad: Usuarios

Rutas internas/ocultas:

- `/dashboard/postcosecha/registros`
- `/dashboard/postcosecha/planificacion/programaciones`
- `/dashboard/postcosecha/planificacion/plan-de-trabajo`

## Data flow

1. `page.tsx` valida acceso con `requirePageAccess()` directa o vía `loadProtectedPageData()`.
2. El loader server usa `src/modules/core/server-page.tsx`.
3. La UI del módulo entra por `src/modules/*`.
4. `src/components/dashboard/*` es legacy congelado; reducido a `module-placeholder.tsx`.
5. SWR revalida contra `src/app/api/*`.
6. Las APIs llaman `src/lib/*` y responden JSON normalizado.

Páginas que necesitan el objeto `access` post-guard (derivar `canWrite`, pasar `username` al mapper) usan `requirePageAccess()` directamente — patrón intencional. Ejemplos: `mi-cuenta/page.tsx`, `mi-trabajo/page.tsx`, `dead-plants-reseed/page.tsx`.

**Páginas con `force-dynamic`:** los maestros de Bodega (categorías, presentaciones, productos, unidades), Campo Drench y Laboratorio Recetas se marcan como `export const dynamic = "force-dynamic"` para que producción standalone los renderice on-demand con sesión + permisos + DB en lugar de comportamiento estático/RSC.

## Pools de base de datos

Cada lib usa el pool correcto por dominio (en `src/lib/db.ts` y satélites):

| Pool | Cluster | Lib típico |
|---|---|---|
| `query` (default → `datalakehouse`) | gld.* materialized views | KPIs (fenograma, mortality, productividad, comparacion, balanzas-core, etc.) |
| `queryAdmin` | `db_admin` | admin-masters-* |
| `queryCamp` | `db_camp` | campo-drench-program |
| `queryBodega` | `db_storageroom` | bodega-masters |
| `queryLaboratory` | `db_laboratory` | laboratory-masters |
| `queryPersonalWorkspace` | `db_personal_workspace` | my-account-repository, my-work-repository |
| `queryPostharvest` | `db_postharvest` | postcosecha-skus |
| `queryHumanTalent` | `db_human_talent` | talento-humano-seguimientos-* |

**Cero cross-cluster JOIN en SQL.** Las uniones cross-pool son a nivel app vía `Promise.all`. Las APIs analíticas leen exclusivamente vistas materializadas `gld.mv_*_cur` / `_day_cur` (cero `vw_`).

## Auth y seguridad

- Sesión por cookie `wh-session`.
- Firma HMAC-SHA256, expiración 24h.
- Login por `username + password`.
- `SESSION_SECRET` obligatorio en producción (mín 32 chars). En desarrollo se deriva del workspace.
- Rotación soportada vía `SESSION_SECRET_PREVIOUS`.

RBAC:

- Roles: `superadmin`, `viewer`, `custom`.
- Recursos por página (URL como key) + paneles fine-grained (`panel:person-sheet.*`, `panel:tthh.followups.*`).
- Páginas protegidas por `requirePageAccess(resourceKey)`.
- APIs protegidas por `requireAuth(request)` + reglas en `API_ACCESS_RULES`.
- Modelo: `deny by default`.

Políticas API:

- `resource-bound` (default)
- `superadmin-only`
- `internal-dev-only`

Casos importantes:

- `/api/health/db` => `superadmin-only`
- `/api/health/live` => público, sin datos sensibles
- `/api/programaciones/debug` => `internal-dev-only`
- `/api/postcosecha/balanzas/schema` => `internal-dev-only` (deprecated 410)
- Mutaciones (POST/PUT/PATCH/DELETE) => `validateMutationOrigin` si `API_ORIGIN_CHECK_ENABLED=true`. GET requests pasan libremente.
- Errores API => `{ message, error, requestId? }`.

**Origin check + nginx:** si la app corre detrás de un reverse proxy nginx en puerto 80 mientras el contenedor expone 7777, agregar **ambos** orígenes:
```env
APP_ORIGIN=http://10.0.2.70
TRUSTED_ORIGINS=http://10.0.2.70,http://10.0.2.70:7777
```
Nginx debe preservar los headers `Origin` y `Referer`. El check loguea denegaciones como `api.origin.denied` con detalle completo (sourceOrigin, allowedOrigins) para diagnóstico.

**Cliente HTTP no-seguro:** browser `crypto.randomUUID` falla fuera de contextos seguros (HTTP por IP). Usar `makeClientId(prefix)` desde `@/shared/lib/client-id` en componentes cliente. Server-side Node crypto sigue siendo válido.

## Docs anti-invención

- `docs/README.md`: índice vivo de documentación oficial.
- Regla corta: si vas a crear algo nuevo, primero demuestra por qué no sirve lo existente en `docs/reuse-index.md`.
- `src/components/dashboard/*` es legacy congelado; todo crecimiento visible nuevo vive en `src/modules/*`.
- `docs/reuse-index.md`: buscar aquí antes de crear componentes/helpers.
- `docs/extender-modulos.md`: flujo único catálogo → page server → loader → UI → API rule → tests → QA.
- `docs/navigation-canon.md`: contrato de rutas y jerarquía visible.
- `docs/ui-canon.md`: reglas visuales y excepciones.
- `docs/security-ops.md`: auth, RBAC, rate limit, health, logging y env.
- `docs/despliegue.md`: deploy manual actual, Docker Compose y runtime env.
- `docs/testing.md`: estrategia de tests sin DB real y smoke manual.
- `docs/definition-of-done.md`: checklist de cierre.
- `docs/module-contracts.md`: contratos de page, API, UI y datos.
- `docs/audits/*`: 17 auditorías formales por dimensión (UX, arquitectura, seguridad, datos, performance, testing, despliegue, docs, funcional, pre-release, cierre, react-doctor x4, mega-audit final).

## UI Canon para Explorers

Estructura estándar para nuevos explorers en `src/modules/*/components/`:

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
- `ChartTooltip`, `RechartsTooltipAdapter`, `axisConfig`, `axisTickStyle`, `axisTickStyleCompact`, `gridConfig` from `@/shared/charts/*`
- `DateField`, `WeekField`, `ToggleChipGroup`, `MultiSelectField`, `SingleSelectField` from `@/shared/filters/*`
- `DialogShell`, `SheetShell` from `@/shared/overlays/*`
- `SortableHeader`, `ScrollFadeTable`, `StandardTable`, `ExpandableTreeTable` from `@/shared/tables/*`
- Formatters from `@/shared/lib/format`: `formatInteger`, `formatDecimal`, `formatFlexibleNumber`, `formatPercent`, `formatHours`, `formatDate`, `formatDateSlash`, `formatDateTime`, `formatCount`, `formatIsoWeekLabel`
- Cliente IDs en componentes UI: `makeClientId` from `@/shared/lib/client-id`

Reglas visuales obligatorias:

- Filtros arriba de KPIs, ambos dentro de `FilterPanel`.
- KPIs siempre con `MetricTile`; no crear `MetricPill` o `SummaryPill` nuevos.
- Charts Recharts siempre con `ChartTooltip`/`RechartsTooltipAdapter` y axis config compartido.
- Overlays nuevos siempre con `DialogShell` o `SheetShell`; no crear z-index custom.
- Colores de charts nuevos vía CSS custom properties (`var(--color-chart-*)`), no hex/rgb inline.
- Superficies tipo panel usan tokens `var(--shadow-*)`; `.starter-panel` consume `--shadow-panel` y tooltips consumen `--shadow-tooltip`.

Excepciones documentadas:

- `campo-map.tsx` conserva colores directos porque Leaflet necesita valores concretos para `L.PathOptions`. Usa panel flotante controlado en lugar de `Popup` de react-leaflet (evita recursión `Maximum call stack size exceeded`).
- Programaciones usa paletas categóricas literales centralizadas en `src/config/programaciones-palettes.ts`.
- `.balanzas-process` conserva colores directos porque el render BPMN/process necesita valores concretos de estado.
- Comparación no requiere `KpiGrid`; su layout de batalla es el contenido principal.
- `fenograma-block-modal.tsx` conserva `MetricPill` local porque es clickeable y de dominio.
- `person-detail-sheet.tsx` puede usar `space-y-6` dentro del overlay para respiración visual.
- `multi-select-field.tsx` usa `createPortal` para posicionar el dropdown fuera del contenedor de scroll. Patrón legítimo de popovers; no aplica el canon de overlays.
- `person-profile-dialog.tsx` (en `src/shared/overlays/`) importa de `@/modules/fenograma/...` y `@/modules/productividad/...` por ser orquestador cross-módulo. Excepción documentada en AUD-2.

## Restricciones

- **`npm run build` y `npm run dev` deben usar `--webpack`.** Turbopack está bloqueado para builds de producción (falla con `leaflet.css` en Windows; el script de package.json ya lo fuerza).
- **Toda la cadena Docker usa `node:20-slim`** (Debian/glibc) para evitar mezclar binarios nativos compilados en Alpine/musl con runtime Debian. No mezclar con Alpine sin testear `sharp` y SWC.
- No agregar `connectionTimeoutMillis` ni `statement_timeout` a `src/lib/db.ts`.
- `next.config.ts` necesita `unsafe-inline`, `unsafe-eval` y `ws:` en CSP.
- Toda API protegida nueva debe registrarse en `src/lib/access-control.ts` (`API_ACCESS_RULES`).
- Todo módulo nuevo debe registrarse primero en `src/config/module-catalog.ts`.
- Todo formatter numérico nuevo debe usar `@/shared/lib/format.ts`.
- No crear explorers nuevos en `src/components/dashboard/`.
- `src/proxy.ts` se mantiene: en Next.js 16 actúa como Proxy/Middleware y el build lo reporta como tal. No renombrar sin validar auth/login en producción.
- Cliente: usar `makeClientId(prefix)` para keys/identificadores; `crypto.randomUUID()` falla en HTTP por IP.

## Sistema canon de PDF

El directorio `pdf-canon/` contiene un sistema completo de plantillas LaTeX institucionales.
Cuando el usuario pida generar un PDF — un botón de impresión, un reporte, un acta, cualquier documento — **usar siempre este sistema**.

### Flujo de trabajo

1. El usuario describe el documento en lenguaje natural.
2. Elegir el template correcto de `pdf-canon/templates/`.
3. Escribir el `.tex` usando **solo** los componentes del canon (ver abajo).
4. La API route invoca `generateCanonicalPdf()` y responde con `pdfBufferToResponse()`.

### Templates disponibles

| Necesidad del usuario | Template a usar |
|---|---|
| Informe ejecutivo, resultados de semana | `informe_ejecutivo.tex` |
| Análisis con tablas largas, estadísticas | `informe_estadistico.tex` |
| Reporte técnico, incidentes, validaciones | `reporte_tecnico.tex` |
| Plan de actividades con responsables | `plan_trabajo.tex` |
| Plan de implementación técnica | `plan_tecnico.tex` |
| Solicitud formal entre áreas | `solicitud_formal.tex` |
| Comunicación interna corta | `memorando.tex` |
| Registro de reunión con acuerdos | `acta_minuta.tex` |
| Una página de KPIs resumidos | `ficha_resumen.tex` |
| Datos de soporte de otro documento | `anexo_tecnico.tex` |
| Orden de trabajo Solver clasificación | `orden_trabajo_clasificacion.tex` |
| Agenda Seguimientos Trabajo Social | `tthh_agenda_seguimientos.tex` |
| Programación drench por bloque (landscape) | `bodega_programacion_drench.tex` |
| Reporte de Punto de apertura (Calidad) | `calidad_punto_apertura.tex` |

### Componentes LaTeX disponibles (no inventar otros)

```
\SetDocTitle, \SetDocCode, \SetDocArea, \SetDocAuthor, \SetDocDate  → metadatos
\SetDocLogo, \SetDocUnit                                             → branding
\SetContactUnit, \SetContactMembers, \SetContactNote                → bloque contacto

\begin{ParrafoEjecutivo}   → párrafo resumen para gerencia
\begin{ParrafoMetodologico}→ descripción técnica de fuentes

\ObservationBox[título]{texto}   → observación con borde lateral gris
\KeyFindingBox[título]{texto}    → hallazgo clave con borde oscuro
\WarningBox[título]{texto}       → alerta con borde rojo
\NoteInline{Etiqueta:} texto     → nota corta inline

\FichaKPI{etiqueta}{valor}{nota} → KPI en caja — usar en tabla 3×N
\MemoBlock{para}{de}{asunto}{ref}→ bloque Para/De/Asunto/Ref
\begin{AsistentesBlock}          → tabla de asistentes en actas
\begin{AcuerdosList}             → lista numerada de acuerdos

\FiguraConFallback[ancho]{ruta}{caption}  → figura con placeholder si ruta no existe
\FiguraPlaceholder[ancho]{descripcion}    → placeholder explícito

\CodePath{ruta/o/endpoint}       → ruta inline en monospace
\begin{CodeBlock} ... \end{CodeBlock}    → bloque de código

\SignatureBlock{nombre}{cargo}   → bloque de firma
\ContactSignature                → bloque de contacto (usa \SetContact*)
\sectionrule                     → separador horizontal

tabular + booktabs (\toprule, \midrule, \bottomrule)   → tablas cortas
longtable + booktabs                                    → tablas que paginan
\begin{adjustbox}{max width=\linewidth}                 → tablas anchas
```

### Reglas

- **No crear estilos nuevos.** Todo lo que se necesita está en `canon.cls`.
- **No usar colores hex directos.** Usar `CanonInk`, `CanonMuted`, `CanonRule`, `CanonSoft`, `CanonSoftLine`, `CanonRed`, `CanonAccent`.
- El encabezado se genera automáticamente — no llamar `\CanonHeader` manualmente.
- Cada documento necesita `\SetDocTitle` y `\SetDocCode` como mínimo.
- Ver ejemplos reales en `pdf-canon/examples/` antes de crear desde cero.

### Integración web (Next.js)

Si el usuario pide un botón que genere el PDF desde la app:
- API route usa `generateCanonicalPdf()` de `@pdf-canon/scripts/generate_pdf_service`
- El template recibe datos dinámicos via `dataTexContent` (comandos `\SetDoc*` + macros)
- Retornar con `pdfBufferToResponse(pdf, "nombre.pdf")`
- Requiere `pdflatex` en el servidor (texlive instalado en el Dockerfile)
- **NUNCA usar Python + reportlab para nuevos PDFs.** Toda generación de PDF debe pasar por `generateCanonicalPdf` para mantener una sola dependencia (pdflatex) y un solo estilo institucional.
- Logo institucional StarFlowers vive en `pdf-canon/assets/logo.pdf`. El servicio reescribe la ruta a `./assets/logo.pdf` automáticamente al copiar `canon_variables.tex` al workDir temporal.
- Para reportes con datos pre-calculados (ej. punto-apertura), separar lógica en `*-pdf-stats.ts` (estadísticas) y `*-pdf-tex.ts` (generación de LaTeX).

Documentación completa: `pdf-canon/docs/`.

## Exports XLSX

Para reportes tabulares con muchas filas (ej. seguimientos), preferir XLSX sobre PDF. Usar `xlsx` (SheetJS) en una API route protegida con auth + RBAC. Ver `src/app/api/talento-humano/seguimientos/export-xlsx/route.ts` como referencia (`/api/talento-humano/seguimientos/export-xlsx`).

## Talento Humano — Colaboradores

El explorador de Colaboradores tiene patrones específicos que conviene reusar:

- **Helpers puros de dominio**: `src/lib/talento-humano-colaboradores-utils.ts` exporta `formatTenureLabel(days)` (devuelve `"21 d"`, `"7 meses"`, `"2 años, 3 meses"`) y `calculateCollaboratorPerformanceTotals(rows)` (agregación ponderada por horas para rendimiento, rendimientoMin y cumplimiento). Cobertura: `src/lib/__tests__/talento-humano-colaboradores-utils.test.ts`.
- **`% Ausentismo` canon**: `absence_rate = SUM(absence_hours WHERE activity_id IN ('F','P','ATR')) / SUM(actual_hours FROM slv.prod_fact_hours_cur)`. Códigos canon: `F` (Faltas), `P` (Permisos con descuento), `ATR` (Atrasos). El resto de códigos en `slv.prod_fact_absenteeism_cur` (AJH, L, PTH, etc.) NO cuentan como ausentismo.
- **Reuso de `PersonMedicalPanel`**: el tab Ficha médica de Colaboradores reusa el componente canon de Fenograma vía re-export en `src/shared/overlays/person-medical-panel.ts`. No duplicar markup médico.
- **Historiales de área**: la query devuelve `tenureDays` calculado en SQL; la UI muestra el label legible vía `formatTenureLabel`.

## Caja/Cama Meta — Productividad

La meta ponderada por ciclo se calcula como `Σ(caja_meta_origen × cajas_aportadas_origen) / Σ(cajas_aportadas_origen)`. Las cajas equivalen a `green_weight_kg / 10`, así que la fórmula es matemáticamente equivalente a pesar por kg de verde, pero la implementación expresa cajas explícitamente para alinearse con la regla de negocio.

Casos especiales del catálogo de orígenes:
- `CLO` (preclasificación normal) → `opening` / "Apertura" como path canon (las metas viven solo bajo ese path tras la migración `sql/migrate_db_admin_boxes_per_bed_clo_opening_only.sql`).
- `CLO PRECLASIFICACION` → se mapea a `opening` en `src/lib/productividad.ts` (no hay `gv` para este origen).

## Metas y objetivos — bulk import + JSONB libre

El editor de Metas (`/dashboard/admin/administracion-maestros/metas-objetivos`) admite caminos heterogéneos vía `target_scope_jsonb.filters` libres (cualquier dimensión, no fija). Hay autogeneración de `target_code` cuando se omite y carga bulk transaccional vía `POST /api/admin/administracion-maestros/metas-objetivos/bulk`. Schema canon: `src/lib/admin-masters-schemas.ts`.

## Deuda arquitectónica conocida

- `src/components/dashboard/` queda reducido a `module-placeholder.tsx`. No crear archivos nuevos allí.
- `fenograma-block-modal.tsx` sigue siendo un componente masivo y debe partirse por subdominios antes de crecer más.
- `src/lib/fenograma.ts` y `src/lib/postcosecha-balanzas.ts` son fachadas temporales; no agregar lógica nueva ahí.
- `src/lib/fenograma-core.ts` y `src/lib/postcosecha-balanzas-core.ts` siguen siendo monolitos de dominio y deben partirse por loaders/mappers/graph/table/options. `postcosecha-balanzas-core.ts` ya supera ~2000 líneas — prioridad alta.
- `src/lib/calidad-punto-apertura.ts` (~441 líneas) — loader único del dominio calidad; sin tests aún; candidato a split loader/mapper cuando crezca.
- Clasificación en blanco y Talento Humano ya tienen split de módulo; mantener sus barrels/orquestadores pequeños.
- `src/lib/salud.ts` (~806 líneas) — loader único de dominio médico con mappers internos; no es candidato a split por coherencia de dominio.
- El canon UX/UI de explorers principales queda cerrado; nuevas divergencias deben documentarse como excepción antes de crecer.
- El build puede emitir warning de Turbopack/NFT por rutas dinámicas del solver de postcosecha; mantenerlo vigilado.

## Variables de entorno

DB principal:

- `DATABASE_URL` (alternativa única) o `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`

DB satélites (cada una con su pool):

- `CAMP_DATABASE_NAME` (Campo)
- `BODEGA_DATABASE_NAME` (alias `db_storageroom`)
- `LABORATORY_DATABASE_NAME`
- `PERSONAL_WORKSPACE_DATABASE_NAME` (+ `PERSONAL_WORKSPACE_DATABASE_URL` opcional)
- `POSTHARVEST_DATABASE_NAME` (+ `POSTHARVEST_AUTO_SEED`, `POSTHARVEST_SOLVER_PYTHON`, `POSTHARVEST_SOLVER_ROOT`)
- `HUMAN_TALENT_DATABASE_NAME` (+ `HUMAN_TALENT_DATABASE_URL` opcional)
- `ADMIN_DATABASE_NAME` (+ `ADMIN_DATABASE_URL` opcional)

DB opcionales:

- `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS`, `SLOW_QUERY_THRESHOLD_MS`
- `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`

Auth:

- `SESSION_SECRET` (obligatorio en prod, ≥32 chars)
- `SESSION_SECRET_PREVIOUS` (rotación)
- `AUTH_MIN_SESSION_SECRET_LENGTH`
- `COOKIE_SECURE` (true bajo HTTPS)
- `APP_ORIGIN`, `TRUSTED_ORIGINS`, `API_ORIGIN_CHECK_ENABLED`
- `LOG_LEVEL`, `LOG_FORMAT`
- `ALLOW_ENV_ADMIN_BYPASS`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

Rate limits:

- `AUTH_RATE_LIMIT_ENABLED`, `RATE_LIMIT_BACKEND` (memory|redis), `REDIS_URL`
- `AUTH_LOGIN_USER_RATE_LIMIT`, `AUTH_LOGIN_IP_RATE_LIMIT`, `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`, `AUTH_LOGIN_DEBUG`
- Por módulo: `ADMIN_USERS_RATE_LIMIT(_WINDOW_MS)`, `DEAD_PLANTS_RESEED_RATE_LIMIT(_WINDOW_MS)`, `PERSONAL_WORKSPACE_WRITE_RATE_LIMIT(_WINDOW_MS)`, `TTHH_FOLLOWUPS_WRITE_RATE_LIMIT(_WINDOW_MS)`, `TTHH_CATALOGS_WRITE_RATE_LIMIT(_WINDOW_MS)`

Chat (Groq):

- `GROQ_API_KEY`, `CHAT_ENABLED`
- `CHAT_MAX_MESSAGES`, `CHAT_MAX_MESSAGE_CHARS`, `CHAT_MAX_CONTEXT_BYTES`
- `CHAT_RATE_LIMIT`, `CHAT_RATE_LIMIT_WINDOW_MS`

Otros opcionales:

- `MEDICAL_SCHEMA`, `MEDICAL_TABLE` (defaults seguros en `salud.ts`)
- `NEXT_PUBLIC_BUILD_COMMIT`, `NEXT_PUBLIC_BUILD_BRANCH`, `NEXT_PUBLIC_BUILD_LABEL` (runtime marker)
- `CANON_DOWNSAMPLE_FACTOR`, `CANON_WEBP_QUALITY` (solo pipeline `canon:v2:*`)
