# CoreX V3 — matriz adicional de convergencia arquitectónica

## Convención de clasificación

- `KEEP_AS_CANON`
- `REFACTOR_INTO_CANON`
- `MERGE_AND_DELETE_DUPLICATE`
- `TEMPORARY_BRIDGE`
- `REMOVE_AFTER_MIGRATION`

## Columna adicional de destino arquitectónico

- `canon`
- `puente`
- `legacy`
- `duplicado`
- `eliminar`

| Archivo | Clasificación | Destino arquitectónico | Motivo técnico | Reemplazo / destino final | Dependencia | Riesgo | Impacta |
|---|---|---:|---|---|---|---|---|
| `src/shared/layout/app-shell.tsx` | KEEP_AS_CANON | canon | Shell central del dashboard | Mantener como layout base | Ninguna | Medio | UI, navegación |
| `src/components/app-sidebar.tsx` | REFACTOR_INTO_CANON | canon | Sigue en `components`, pero es el sidebar real | Mantener mientras se decide mover a `shared/navigation` | `AppShell` | Medio | UI, navegación |
| `src/components/sidebar/nav-item.tsx` | REFACTOR_INTO_CANON | canon | Árbol de navegación útil pero con ajustes pendientes | Base del `SidebarNavTree` definitivo | `app-sidebar.tsx` | Medio | UI, navegación |
| `src/components/site-footer.tsx` | REFACTOR_INTO_CANON | canon | Footer global útil, ahora fijo | Puede moverse después a `shared/layout` | `AppShell` | Bajo | UI, navegación |
| `src/shared/overlays/dialog-shell.tsx` | KEEP_AS_CANON | canon | Dialog reusable válido | Mantener y extender | Ninguna | Bajo | overlays |
| `src/shared/overlays/sheet-shell.tsx` | KEEP_AS_CANON | canon | Nueva base reusable para panel lateral | Mantener como shell canónico | Ninguna | Medio | overlays |
| `src/components/dashboard/person-info-overlay.tsx` | TEMPORARY_BRIDGE | puente | Fachada legacy necesaria para no romper imports | Reemplazada internamente por `PersonDetailSheet` | `person-detail-sheet.tsx` | Bajo | overlays, UI |
| `src/modules/talento-humano/components/person-detail-sheet.tsx` | KEEP_AS_CANON | canon | Patrón reusable para perfil de persona | Base para futuros perfiles personales | `SheetShell` | Medio | overlays, datos |
| `src/shared/filters/multi-select-field.tsx` | KEEP_AS_CANON | canon | Multiselect reutilizable ya convergido | Mantener como único multiselect real | Ninguna | Medio | filtros, UI |
| `src/components/ui/multi-select-field.tsx` | TEMPORARY_BRIDGE | puente | Reexport para compatibilidad | Mantener solo mientras existan imports legacy | `shared/filters/multi-select-field.tsx` | Bajo | filtros |
| `src/shared/lib/format.ts` | KEEP_AS_CANON | canon | Canon numérico y fechas | Mantener y migrar consumidores restantes | Ninguna | Bajo | UI, tablas, charts |
| `src/modules/talento-humano/components/shared.tsx` | REFACTOR_INTO_CANON | canon | Hub reusable de Talento Humano | Debe seguir perdiendo lógica visual local con el tiempo | `shared/*` | Medio | filtros, tablas, charts |
| `src/components/dashboard/talento-shared.tsx` | TEMPORARY_BRIDGE | puente | Reexport de compatibilidad | Eliminar al terminar migración de imports | `modules/talento-humano/components/shared.tsx` | Bajo | UI |
| `src/components/dashboard/talento-demografia-explorer.tsx` | TEMPORARY_BRIDGE | puente | Fachada legacy | Eliminar luego de migración de rutas/imports | `modules/talento-humano/components/demografia-page.tsx` | Bajo | UI |
| `src/components/dashboard/talento-composicion-explorer.tsx` | TEMPORARY_BRIDGE | puente | Fachada legacy | Eliminar luego de migración de rutas/imports | `modules/talento-humano/components/composicion-page.tsx` | Bajo | UI |
| `src/components/dashboard/talento-rotacion-explorer.tsx` | TEMPORARY_BRIDGE | puente | Fachada legacy | Eliminar luego de migración de rutas/imports | `modules/talento-humano/components/rotacion-page.tsx` | Bajo | UI |
| `src/components/ui/*` primitivos reexport | TEMPORARY_BRIDGE | puente | Compatibilidad controlada | Eliminar cuando todos consuman `src/shared/ui/*` | `shared/ui/*` | Bajo | UI |
| `src/shared/ui/*` | KEEP_AS_CANON | canon | Sistema UI canónico real | Mantener | Ninguna | Bajo | UI |
| `src/components/dashboard/productividad-explorer.tsx` | REFACTOR_INTO_CANON | legacy | Sigue siendo monolito grande | Debe dividirse por dominio y vistas parciales | `shared/lib/format.ts`, futuros módulos | Alto | UI, datos |
| `src/components/dashboard/fenograma-explorer.tsx` | REFACTOR_INTO_CANON | legacy | Explorer crítico todavía monolítico | Debe migrar a módulo dedicado | futuros módulos fenograma | Alto | UI, datos |
| `src/components/dashboard/postcosecha-clasificacion-en-blanco-explorer.tsx` | REFACTOR_INTO_CANON | legacy | Explorer pesado con formato y lógica embebidos | Split en módulo + subcomponentes | shared/forms, shared/tables | Alto | UI, datos |
| `src/components/dashboard/postcosecha-skus-explorer.tsx` | REFACTOR_INTO_CANON | legacy | Vista funcional pero aún grande | Migrar a módulo canónico | shared/forms, shared/tables | Medio | UI, datos |
| `src/server/*` | KEEP_AS_CANON | canon | Capa correcta para auth/cache/db | Mantener y ampliar | Ninguna | Bajo | seguridad, datos |
| `src/lib/auth.ts` | REFACTOR_INTO_CANON | canon | Sigue como núcleo auth válido | Mantener mientras se completa separación hacia `src/server/auth/*` | `proxy.ts`, api auth | Medio | seguridad |
| `src/proxy.ts` | REFACTOR_INTO_CANON | canon | Middleware crítico ya endurecido | Mantener con futuras mejoras CSRF/auditoría | auth | Medio | seguridad |

## Resumen operativo

### Canon objetivo

- `src/shared/*`
- `src/modules/*`
- `src/server/*`

### Puentes temporales aceptados en V3

- `src/components/ui/*`
- `src/components/dashboard/person-info-overlay.tsx`
- wrappers talento legacy

### Legacy a desmantelar progresivamente

- explorers grandes en `src/components/dashboard/*`

### Duplicación que debe eliminarse

- imports que todavía entren por `src/components/ui/*` pudiendo entrar directo por `src/shared/ui/*`
- helpers inline de formato numérico en explorers no migrados

### Regla reforzada para V4+

Si dos sistemas hacen lo mismo, uno debe quedar como canon y el otro debe quedar explícitamente marcado como puente o eliminación. No debe seguir habiendo coexistencia decorada.
# LEGACY / reference only

Este documento describe una etapa previa. Para reglas vigentes usar `docs/reuse-index.md`, `docs/extender-modulos.md`, `docs/ui-canon.md` y `docs/security-ops.md`.
