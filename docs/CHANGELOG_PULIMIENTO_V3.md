# CoreX — Pulimiento V3 aplicado

## Alcance real de esta intervención

Esta versión V3 no maquilla el repo. Prioriza convergencia real sobre tres frentes:

1. layout global y navegación estable
2. overlays/sheets reutilizables
3. filtros y formato numérico más coherentes

## Cambios implementados

### 1. Layout y navegación

- `src/shared/layout/app-shell.tsx`
  - el dashboard ahora trabaja con `h-screen` y `overflow-hidden`
  - el scroll principal queda en `main`
  - el sidebar deja de depender del scroll de página
  - se reserva espacio estable para footer sticky

- `src/components/app-sidebar.tsx`
  - header y footer quedan fijos dentro del sidebar
  - solo el cuerpo del menú scrollea
  - se corrige distribución vertical para vistas largas

- `src/components/sidebar/nav-item.tsx`
  - labels con mejor legibilidad
  - menos compresión visual
  - grupos colapsables con mejor manejo de overflow

- `src/components/site-footer.tsx`
  - footer sticky agregado con la leyenda requerida:
    - `Elaborado por equipo de planificación`

### 2. Familia canónica de overlays

- nuevo `src/shared/overlays/sheet-shell.tsx`
  - backdrop consistente
  - cierre por click externo
  - cierre por `Escape`
  - control de scroll del `document.body`
  - header sticky
  - body scrollable
  - footer sticky opcional

- `src/shared/overlays/dialog-shell.tsx`
  - endurecido para altura máxima, scroll interno y escape handling

- nuevo `src/modules/talento-humano/components/person-detail-sheet.tsx`
  - ficha reusable de colaborador
  - base canónica para futuros perfiles personales

- `src/components/dashboard/person-info-overlay.tsx`
  - queda como fachada legacy sobre el nuevo `PersonDetailSheet`

### 3. Filtros

- `src/shared/filters/multi-select-field.tsx`
  - panel flotante con mejor posicionamiento
  - ancho y altura acotados al viewport
  - selección múltiple estable sin cerrar dropdown al seleccionar
  - búsqueda interna
  - chips visibles
  - acciones: `Todo`, `Limpiar`, `Restablecer`, `Aplicar`

- `src/modules/talento-humano/components/shared.tsx`
  - toolbar de Talento Humano con `overflow-visible`
  - se reduce la posibilidad de que los filtros colapsen visualmente

### 4. Formato numérico canónico

- nuevo `src/shared/lib/format.ts`
  - `formatInteger`
  - `formatDecimal`
  - `formatFlexibleNumber`
  - `formatHours`
  - `formatPercent`
  - `formatDate`

- migraciones puntuales realizadas en:
  - `src/modules/talento-humano/components/shared.tsx`
  - `src/modules/talento-humano/components/demografia-page.tsx`
  - `src/modules/talento-humano/components/composicion-page.tsx`
  - `src/modules/talento-humano/components/rotacion-page.tsx`
  - `src/components/dashboard/productividad-explorer.tsx`
  - `src/modules/users/components/users-page.tsx`
  - `src/components/dashboard/fenograma-explorer.tsx`
  - `src/components/dashboard/fenograma-weekly-bars-chart.tsx`

### 5. Seguridad

- `src/proxy.ts`
  - se elimina el secreto inseguro por defecto en producción
  - se alinea la validación con expiración y firma HMAC real
  - el fallback dev queda restringido a entornos no productivos

## Archivos nuevos clave

- `src/shared/lib/format.ts`
- `src/shared/overlays/sheet-shell.tsx`
- `src/modules/talento-humano/components/person-detail-sheet.tsx`
- `docs/CHANGELOG_PULIMIENTO_V3.md`
- `docs/V3_EXECUTION_PLAN.md`
- `docs/V3_ARCHITECTURE_MATRIX.md`

## Deuda viva que aún queda después de esta intervención

### Deuda resuelta

- sidebar con header/footer fijos
- footer global fijo
- familia base de sheet reutilizable
- ficha de persona migrada a patrón reusable
- multiselect con flujo más robusto
- primer bloque real de formato numérico centralizado
- secreto inseguro por defecto removido del proxy en producción

### Deuda mitigada pero no cerrada

- todavía existen explorers legacy grandes en `src/components/dashboard/*`
- el formato numérico ya tiene canon, pero aún faltan consumidores legacy por migrar
- `src/components/ui/*` y `src/shared/ui/*` conviven, aunque los primeros ya son fachadas en los primitivos principales
- formularios compartidos siguen siendo mínimos

### Deuda pospuesta con justificación

- auditoría persistente (`audit_log`) no se implementó a nivel DB por falta de contrato de tabla estable dentro del zip entregado
- CSRF formal end-to-end no se añadió para no introducir ruptura en flujo actual sin revisar todas las rutas mutantes
- varios módulos legacy de postcosecha y fenograma requieren split por dominio completo, fuera del alcance razonable de este pulimiento puntual
# LEGACY / reference only

Este changelog es historico. Para reglas vigentes usar `docs/reuse-index.md`, `docs/extender-modulos.md`, `docs/ui-canon.md` y `docs/security-ops.md`.
