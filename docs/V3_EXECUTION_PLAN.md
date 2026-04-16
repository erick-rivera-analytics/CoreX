# CoreX V3 — plan ejecutable y verificable

## FASE 0 — inventario real del repo

### Canon actual

- `src/shared/*`
- `src/modules/*`
- `src/server/*`

### Legacy todavía activo

- `src/components/dashboard/*`

### Puentes ya existentes

- `src/components/ui/*` reexportando desde `src/shared/ui/*`
- `src/components/dashboard/talento-*.tsx` reexportando desde `src/modules/talento-humano/*`

### Archivos tocados en V3

- `src/shared/layout/app-shell.tsx`
- `src/components/app-sidebar.tsx`
- `src/components/sidebar/nav-item.tsx`
- `src/components/site-footer.tsx`
- `src/shared/overlays/dialog-shell.tsx`
- `src/shared/overlays/sheet-shell.tsx`
- `src/components/dashboard/person-info-overlay.tsx`
- `src/modules/talento-humano/components/person-detail-sheet.tsx`
- `src/shared/filters/multi-select-field.tsx`
- `src/shared/lib/format.ts`
- `src/modules/talento-humano/components/shared.tsx`
- `src/modules/talento-humano/components/demografia-page.tsx`
- `src/modules/talento-humano/components/composicion-page.tsx`
- `src/modules/talento-humano/components/rotacion-page.tsx`
- `src/components/dashboard/productividad-explorer.tsx`
- `src/modules/users/components/users-page.tsx`
- `src/components/dashboard/fenograma-explorer.tsx`
- `src/components/dashboard/fenograma-weekly-bars-chart.tsx`
- `src/proxy.ts`

## FASE 1 — canon UI/shared

### Objetivo

Consolidar `src/shared/*` como base real de layout, overlays, filtros y formato.

### Archivos a tocar

- `src/shared/layout/app-shell.tsx`
- `src/shared/overlays/dialog-shell.tsx`
- `src/shared/overlays/sheet-shell.tsx`
- `src/shared/lib/format.ts`

### Archivos que deben dejar de ser referencia

- overlays ad hoc dentro de vistas
- helpers inline de formato numérico

### Criterio de aceptación técnico

- existe una familia base de overlay reutilizable
- existe librería central de formato numérico

### Pruebas manuales mínimas

- abrir dashboard con vista larga
- abrir modal y sheet
- validar scroll interno y cierre con `Escape`

### Riesgo de regresión

- medio

## FASE 2 — overlays y navegación

### Objetivo

Eliminar colapso del panel de personal y hacer estable el sidebar.

### Archivos a tocar

- `src/components/app-sidebar.tsx`
- `src/components/sidebar/nav-item.tsx`
- `src/components/site-footer.tsx`
- `src/components/dashboard/person-info-overlay.tsx`
- `src/modules/talento-humano/components/person-detail-sheet.tsx`

### Archivos que deben dejar de ser referencia

- panel lateral improvisado dentro de `person-info-overlay.tsx`

### Criterio de aceptación técnico

- sidebar con header/footer fijos
- panel personal con scroll interno correcto

### Pruebas manuales mínimas

- scrollear una vista larga
- abrir ficha de persona y recorrer contenido completo

### Riesgo de regresión

- medio

## FASE 3 — filtros y formatos numéricos

### Objetivo

Convergencia funcional y visual de multiselect + primer bloque fuerte de normalización numérica.

### Archivos a tocar

- `src/shared/filters/multi-select-field.tsx`
- `src/shared/lib/format.ts`
- `src/modules/talento-humano/components/shared.tsx`
- `src/components/dashboard/productividad-explorer.tsx`

### Migraciones de imports

- usar `@/shared/lib/format`
- usar `@/shared/filters/multi-select-field`

### Criterio de aceptación técnico

- multiselect no se cierra al elegir
- hay acciones `Todo`, `Limpiar`, `Restablecer`, `Aplicar`
- los números migrados salen con formato español consistente

### Pruebas manuales mínimas

- abrir filtros de Talento Humano
- seleccionar múltiples opciones
- aplicar y restablecer
- revisar KPIs y tablas migradas

### Riesgo de regresión

- medio

## FASE 4 — Talento Humano

### Objetivo

Alinear Talento Humano al canon nuevo sin dejar el detalle personal en patrón aparte.

### Archivos a tocar

- `src/modules/talento-humano/components/shared.tsx`
- `src/modules/talento-humano/components/demografia-page.tsx`
- `src/modules/talento-humano/components/composicion-page.tsx`
- `src/modules/talento-humano/components/rotacion-page.tsx`
- `src/modules/talento-humano/components/person-detail-sheet.tsx`

### Criterio de aceptación técnico

- Talento Humano usa el mismo canon de filtros
- el detalle personal es reusable
- métricas visibles migradas al nuevo formato

### Pruebas manuales mínimas

- Demografía
- Composición
- Rotación
- abrir lista de personas y luego ficha individual

### Riesgo de regresión

- medio

## FASE 5 — explorers legacy de mayor riesgo

### Objetivo

Aplicar correcciones de mayor impacto sin hacer greenfield completo.

### Archivos a tocar

- `src/components/dashboard/productividad-explorer.tsx`
- `src/components/dashboard/fenograma-explorer.tsx`
- `src/components/dashboard/fenograma-weekly-bars-chart.tsx`
- `src/modules/users/components/users-page.tsx`

### Criterio de aceptación técnico

- labels críticas corregidas
- primeros consumidores legacy migrados a formato numérico canónico

### Riesgo de regresión

- medio / alto

## FASE 6 — seguridad y backend

### Objetivo

Eliminar defaults inseguros obvios y dejar la base más sana.

### Archivos a tocar

- `src/proxy.ts`

### Criterio de aceptación técnico

- no existe secreto fijo inseguro en producción
- el proxy valida expiración además de firma

### Riesgo de regresión

- bajo / medio

## FASE 7 — limpieza final de duplicados y deuda residual

### Objetivo

Documentar deuda viva y dejar claro qué sigue en puente y qué debe morir.

### Archivos a tocar

- `docs/V3_ARCHITECTURE_MATRIX.md`
- `docs/CHANGELOG_PULIMIENTO_V3.md`

### Criterio de aceptación técnico

- deuda viva explícita
- clasificación por destino arquitectónico visible

### Riesgo de regresión

- bajo
# LEGACY / reference only

Este plan describe una etapa previa. Para reglas vigentes usar `docs/reuse-index.md`, `docs/extender-modulos.md`, `docs/ui-canon.md` y `docs/security-ops.md`.
