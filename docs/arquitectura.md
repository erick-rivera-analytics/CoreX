> Referencia vigente. Frontera `app → modules → shared+lib` y reglas canónicas.

# Arquitectura — CoreX v4

Documento vivo de la arquitectura actual. Reemplaza el archivo homónimo archivado en `legacy/`.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.2.4 (App Router, Webpack) |
| UI | React 19, Tailwind CSS 4 |
| Lenguaje | TypeScript 5.9 (strict) |
| Base de datos | PostgreSQL via `pg` (sin ORM) |
| Data fetching client | SWR |
| UI primitives | shadcn/ui compatible (`src/shared/ui`) |
| Testing | Vitest |
| Auth | Cookie HMAC-SHA256 + middleware |

---

## Capas (frontera inmutable)

```
src/app  →  src/modules  →  src/shared + src/lib
```

Ninguna capa puede importar de una capa "superior":

| Capa | Puede importar de | Nunca importa de |
|------|-------------------|-----------------|
| `src/app` | modules, shared, lib, config | — |
| `src/modules` | shared, lib, config | app |
| `src/shared` | lib, config | app, modules |
| `src/lib` | config, server | app, modules, shared |

### Descripción de cada capa

**`src/app/`** — Next.js App Router. Rutas, layouts, `page.tsx`, `route.ts` (API handlers). Es el único punto de entrada HTTP. No contiene lógica de negocio.

**`src/modules/`** — UI por módulo. Cada módulo tiene `components/` y opcionalmente `hooks/`. Los explorers viven aquí. **Todo crecimiento nuevo de UI va aquí**, nunca en `src/components/dashboard/`.

**`src/shared/`** — Piezas reutilizables sin estado de dominio:
- `charts/` — `ChartTooltip`, `RechartsTooltipAdapter`, `axisConfig`, `gridConfig`
- `data-display/` — `MetricTile`, `ChartSurface`, `EmptyState`
- `filters/` — `DateField`, `WeekField`, `ToggleChipGroup`, `MultiSelectField`, `SingleSelectField`
- `layout/` — `SectionPageShell`, `FilterPanel`, `KpiGrid`, `ChartSection`, `DetailSection`
- `lib/` — Formatters: `formatInteger`, `formatDecimal`, `formatPercent`, `formatFlexibleNumber`, `formatHours`, `formatDate`, `formatDateTime`
- `overlays/` — `DialogShell`, `SheetShell`
- `tables/` — `ScrollFadeTable`, `StandardTable`, `SortableHeader`, `ClickableTableRow`
- `ui/` — Primitivos base (Button, Badge, etc.)

**`src/lib/`** — Queries SQL, auth, RBAC, cache, lógica de dominio. Sin imports de React.

**`src/config/`** — Catálogos estáticos. `module-catalog.ts` es la fuente de verdad de todo el sistema de módulos.

**`src/server/`** — Auth server-side, rate-limit, server cache.

**`src/components/dashboard/`** — LEGACY CONGELADO. No agregar nada aquí. Sólo existe `module-placeholder.tsx` como shim temporal.

---

## Data flow

```
1. Usuario → /dashboard/modulo
       ↓
2. src/app/(dashboard)/dashboard/modulo/page.tsx
   - requirePageAccess(resourceKey) — valida sesión + RBAC
   - loadProtectedPageData() o loader del módulo
       ↓
3. src/modules/modulo/components/ModuloExplorer.tsx
   - Renderiza shell + filtros + KPIs
   - SWR fetches a /api/modulo?...
       ↓
4. src/app/api/modulo/route.ts
   - requireAuth(request) — re-valida token, verifica policy
   - Llama src/lib/modulo.ts
   - Retorna JSON normalizado
       ↓
5. src/lib/modulo.ts
   - cachedAsync(key, ttl, () => query<Row>(sql, params))
   - Mapea rows a tipos TS
   - Retorna payload tipado
       ↓
6. PostgreSQL (pool pg)
   - gld.mv_* materialized views
   - slv.camp_dim_* SCD2 tables
```

### Respuesta de error estándar

```ts
{ message: string; error?: string; requestId?: string }
```

- `message`: texto legible por humanos
- `error`: código de error interno (opcional)
- `requestId`: UUID de trazabilidad en rutas nuevas

---

## Auth y RBAC

### Sesión

- Cookie `wh-session` firmada con HMAC-SHA256
- Expiración 24h
- Secreto en `SESSION_SECRET` (obligatorio en producción)
- Login: `username + password` contra tabla de usuarios en DB

### Roles

| Rol | Acceso |
|-----|--------|
| `superadmin` | Todos los módulos activos + internos |
| `viewer` | Todos los módulos activos no-administrativos |
| `custom` | Solo los recursos explícitamente habilitados |

### Políticas de API

| Política | Comportamiento |
|----------|---------------|
| `resource-bound` | El usuario debe tener el `resourceKey` en sus permisos |
| `superadmin-only` | Solo superadmin (ej: `/api/health/db`) |
| `internal-dev-only` | Solo entornos internos (ej: `/api/programaciones/debug`) |

Las reglas están en `src/lib/access-control.ts` → `API_ACCESS_RULES`. Toda API protegida nueva **debe registrarse ahí**.

---

## Module Catalog

**Archivo:** `src/config/module-catalog.ts`

Es la **única fuente de verdad** para:
- Navegación (sidebar, mobile nav, home)
- Visibilidad (`active` | `hidden` | `internal`)
- Recursos RBAC (`href` = resourceKey)
- Metadatos de página (eyebrow, title, icon)

**Todo módulo nuevo empieza aquí.** Los derivados que se actualizan automáticamente:
- `src/config/sidebar-data.ts`
- `src/config/dashboard.ts`
- `src/lib/access-control.ts` (ACCESS_RESOURCES, ADMIN_RESOURCE_KEYS)

### Estados de módulo

| Estado | Visible en nav | Accesible con RBAC | Aparece en RBAC admin |
|--------|---------------|--------------------|-----------------------|
| `active` | Sí | Sí | Sí |
| `hidden` | No | Sí (si tiene permiso) | No |
| `internal` | No | Solo superadmin | No |

---

## Convenciones de naming

### Archivos

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Componente React | `kebab-case.tsx` | `mortality-curve-chart.tsx` |
| Lib/query | `kebab-case.ts` | `productividad.ts` |
| API route | `route.ts` dentro de carpeta | `app/api/mortality/route.ts` |
| Page | `page.tsx` dentro de carpeta | `app/(dashboard)/dashboard/mortality/page.tsx` |
| Tipos de módulo | `kebab-case.ts` | no separar si es pequeño |

### TypeScript

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Tipos de query row | `*QueryRow` | `MortalityQueryRow` |
| Tipos de fila procesada | `*Row` | `MortalityRow` |
| Tipos de filtro | `*Filters` | `ProductividadFilters` |
| Tipos de payload API | `*Payload` | `MortalityDashboardPayload` |
| Constantes de fuente SQL | `*_SOURCE` | `KARDEX_CYCLE_SOURCE` |

### Componentes

Todos los explorers siguen la estructura canónica de `CLAUDE.md`:
```tsx
<SectionPageShell>
  <FilterPanel>
    <KpiGrid> ... </KpiGrid>
  </FilterPanel>
</SectionPageShell>
<ChartSection> ... </ChartSection>
<DetailSection> ... </DetailSection>
```

Cualquier divergencia debe documentarse como excepción en `ui-canon.md` antes de implementarse.

---

## Caching del servidor

`src/server/cache.ts` expone `cachedAsync(key, ttlMs, fn)` — cache en memoria del proceso Node.js. Los TTLs típicos:

| Tipo de dato | TTL |
|-------------|-----|
| Opciones de filtro | 5 min |
| Dashboard principal | 30 s |
| Detalle de bloque/ciclo | 60 s |
| Perfil de persona | 5 min |
| Programaciones | 5 min |

El cache se limpia al reiniciar el proceso. No hay Redis en producción actual (la infraestructura lo soporta pero no está habilitado).

---

## Archivos grandes — vigilar

Los siguientes archivos son monolitos de dominio que están en la lista de retiro parcial:

| Archivo | Tamaño aprox. | Plan |
|---------|--------------|------|
| `src/lib/fenograma-core.ts` | ~90 KB | Partir por loaders/mappers/graph/table |
| `src/lib/postcosecha-balanzas-core.ts` | ~45 KB | Partir por loaders/mappers |
| `src/modules/fenograma/components/fenograma-block-modal.tsx` | grande | Partir por paneles de subdominio |

No agregar lógica nueva a estos archivos — abrir submódulos específicos.
