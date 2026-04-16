# Changelog pulimiento V4

## Cambios principales

### Canon visual y estructura de vistas
- Se introdujo `SectionPageShell` como encabezado reutilizable para vistas principales.
- Se introdujeron `FilterPanel`, `KpiGrid`, `ChartSection` y `DetailSection` para unificar la secuencia visual:
  filtro -> KPI -> charts -> detalle.
- Se migraron a este patrón:
  - Productividad
  - Fenograma
  - Talento Humano: Composición laboral, Demografía personal y Rotación laboral.

### Filtros
- Productividad dejó de usar selects simples para año, mes, área, tipo SP, variedad y estado.
- Esos filtros ahora usan multiselección reusable con búsqueda y acciones de selección.
- Fenograma quedó alineado al mismo stack reusable de filtros compartidos.

### Formato numérico
- Se reforzó el uso de `src/shared/lib/format.ts` en vistas clave.
- Se corrigieron formateos visibles en:
  - Fenograma block modal
  - Person hours overlay
  - Fenograma pivot table
- El estándar visible buscado es:
  - punto para miles
  - coma para decimales

### Trazabilidad de `A-4`
- La normalización central `A-4 -> SJP` ya existía en `src/shared/lib/area-normalization.ts`.
- El problema estaba en Fenograma porque una parte del pipeline renderizaba `entry.area` con `cleanText(...)` en vez de `normalizeAreaDisplayName(...)`.
- También las opciones de filtro se estaban devolviendo sin normalización final.
- Se corrigió:
  - normalización de filas pivot del Fenograma
  - normalización de opciones del filtro de área en Fenograma.

### Inicio / Home
- La portada dejó de depender solo de `dashboardViews`.
- Ahora se alinea con el árbol real del sidebar filtrado por acceso.
- La portada muestra módulos activos y próximos para no quedar desfasada respecto a la navegación lateral.

### Texto UI y navegación
- Se corrigieron múltiples labels visibles en navegación/config:
  - Gestión
  - Administración
  - Comparación
  - Composición laboral
  - Demografía personal
  - Rotación laboral
  - Clasificación en blanco
  - Documentación
  - Auditoría

## Deuda viva
- Siguen existiendo explorers legacy pesados en `src/components/dashboard/*`.
- La convergencia total a `src/shared/*` y `src/modules/*` sigue avanzada pero no cerrada.
- Aún quedan vistas fuera del alcance V4 con formato numérico legacy en `en-US`.
# LEGACY / reference only

Este changelog es historico. Para reglas vigentes usar `docs/reuse-index.md`, `docs/extender-modulos.md`, `docs/ui-canon.md` y `docs/security-ops.md`.
