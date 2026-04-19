> LEGACY / reference only.

# CoreX — reorganización aplicada

Se dejó una base nueva para escalar sin seguir duplicando componentes.

## Qué se movió a zonas comunes

- `src/shared/ui`: primitivos visuales canónicos.
- `src/shared/filters`: filtros reutilizables, incluido multiselect persistente.
- `src/shared/data-display`: cards métricas, superficies de charts y estados vacíos.
- `src/shared/tables`: wrappers estándar de tabla y scroll horizontal.
- `src/shared/forms`: switch reutilizable.
- `src/shared/layout`: shell principal del dashboard.
- `src/server/*`: rutas de compatibilidad para auth/cache/db.
- `src/modules/users` y `src/modules/talento-humano`: primer corte modular real.

## Cambios funcionales aplicados

- Botón de activar/desactivar usuarios reconstruido con switch estable.
- Los tres explorers de Talento Humano ahora comparten set de filtros base.
- El multiselect no colapsa al seleccionar y trae búsqueda interna.
- Tablas y cards principales usan el mismo lenguaje visual base.
- El layout principal quedó encapsulado en `src/shared/layout/app-shell.tsx`.

## Compatibilidad

Se dejaron archivos legacy como fachadas para no romper imports existentes mientras migras el resto de módulos.
> LEGACY / reference only. No usar este documento como fuente viva de crecimiento.
