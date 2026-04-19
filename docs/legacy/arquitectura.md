> LEGACY / reference only.

# Arquitectura del proyecto

## Objetivo

`CoreX` es un dashboard interno para operacion agricola. La arquitectura actual prioriza:

- una fuente de verdad unica para modulos visibles
- separacion clara entre `app`, `modules`, `shared` y `lib`
- RBAC real en paginas y APIs
- crecimiento incremental sin reescrituras grandes

## Capas activas

```text
src/app -> src/modules -> src/shared + src/lib
```

### `src/app`

- define rutas y layouts
- valida acceso server-side
- monta loaders iniciales

### `src/modules`

- superficie estable de cada pantalla
- punto de entrada recomendado para UI de modulo
- wrappers server/client que encapsulan explorers legacy cuando aplica

### `src/shared`

- layout, tablas, overlays, data-display y primitives reutilizables

### `src/lib`

- acceso a DB
- auth
- RBAC
- queries y transformacion de datos
- helpers de API

## Fuente de verdad de modulos

`src/config/module-catalog.ts` concentra:

- `href`
- `label`
- `title`
- `eyebrow`
- `summary`
- `status`
- `navigationGroup`
- `mobileVisible`

Desde ese catalogo se derivan:

- `src/config/sidebar-data.ts`
- `src/config/dashboard.ts`
- recursos RBAC visibles

Estados disponibles:

- `active`
- `hidden`
- `internal`

Los modulos `hidden` no aparecen en sidebar, home ni mobile nav.

## Auth y control de acceso

### Paginas

- `src/proxy.ts` protege `/dashboard/*`
- `requirePageAccess(resourceKey)` aplica RBAC en server components

### APIs

- `requireAuth(request)` aplica auth y autorizacion
- las reglas viven en `src/lib/access-control.ts`
- el modelo actual es `deny by default`

Politicas soportadas:

- `resource-bound`
- `superadmin-only`
- `internal-dev-only`

Casos especiales:

- `/api/health/db` => `superadmin-only`
- `/api/programaciones/debug` => `internal-dev-only`

## Flujo de datos

1. `page.tsx` valida acceso.
2. Un loader server obtiene datos iniciales.
3. El modulo renderiza con esos datos.
4. El cliente revalida por SWR cuando aplica.
5. La API normaliza filtros, llama `src/lib/*` y responde JSON.

## Estado visible del producto

Activos:

- campo
- fenograma
- mortandades
- comparacion
- productividad
- programaciones
- balanzas
- administrar SKU's
- clasificacion en blanco
- talento humano
- usuarios

Ocultos hasta estar listos:

- registros
- programaciones de postcosecha
- plan de trabajo
> LEGACY / reference only. Ver `docs/module-contracts.md` y `docs/extender-modulos.md` para crecimiento vigente.
