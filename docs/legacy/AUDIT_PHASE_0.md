> LEGACY / reference only.

# Auditoria Fase 0

Linea base para la primera ola de pulimiento conservador del sistema.

## Modulos ancla para validacion

| Modulo | Estado actual | Observacion |
| --- | --- | --- |
| Login | Activo | Pantalla consistente y util como referencia visual de acceso. |
| Dashboard home | Activo | Ya refleja el arbol real, pero convive con rutas placeholder. |
| Fenograma | Activo | Referencia principal para filtros, KPIs, grafica y drill-down. |
| Balanzas | Activo | Modulo real con UX mas densa y estados de origen visibles. |
| Talento Humano / Rotacion laboral | Activo | Buen candidato para validar charts, filtros por rango y modal de detalle. |
| Administracion / Usuarios | Activo | Modulo real para validar CRUD, tablas, dialogs y mensajes. |

## Rutas placeholder visibles

| Ruta | Estado actual | Decision de esta fase |
| --- | --- | --- |
| `/dashboard/postcosecha/registros` | Placeholder navegable | Mantener visible, pero marcarla inequívocamente como "Proximo". |
| `/dashboard/postcosecha/planificacion/programaciones` | Placeholder navegable | Mantener visible, pero bajar expectativa de modulo listo. |
| `/dashboard/postcosecha/planificacion/plan-de-trabajo` | Placeholder navegable | Mantener visible, pero presentar como preparacion de arquitectura. |

## Backlog base confirmado

- `lint` no esta verde por deuda en hooks, memoizacion y scripts auxiliares.
- Existen patrones visuales compartidos, pero no todos los modulos ancla convergen al mismo lenguaje.
- Algunas rutas placeholder todavia se leen como modulos normales.
- El asistente flotante global no aporta contexto real en la mayoria de pantallas.
- La capa de errores API mezcla `message` y `error`.
- Hay endurecimiento pendiente en logs, scripts operativos y bypass de entorno.

## Restricciones vigentes

- No tocar esquema SQL ni introducir migraciones.
- No mover rutas principales.
- No rediseñar branding ni shell completo.
- No cambiar proveedores externos en esta ola.
- Priorizar quick wins validables y reversibles.
# LEGACY / reference only

Este documento es historico. Para reglas vigentes usar `docs/reuse-index.md`, `docs/extender-modulos.md`, `docs/ui-canon.md` y `docs/security-ops.md`.
> LEGACY / reference only. No usar este documento como fuente viva de crecimiento.
