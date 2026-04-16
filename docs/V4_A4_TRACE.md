> LEGACY / reference only.

# Trazabilidad de `A-4`

## Hallazgo
La app ya tenía una normalización central de área en:

- `src/shared/lib/area-normalization.ts`

con el alias:

- `A-4 -> SJP`

## Problema real detectado
El valor todavía podía aparecer en Fenograma porque el flujo no estaba cerrado en todos los puntos.

### Punto correcto
- La normalización existía en la capa reusable.

### Punto defectuoso
- En `src/lib/fenograma.ts`, dentro de la construcción de filas pivot, el campo `area` se estaba asignando con `cleanText(entry.area)`.
- Eso evitaba aplicar la normalización reusable.

### Segundo punto defectuoso
- En la carga de opciones de filtro (`loadFenogramaFilterOptions`) las áreas se devolvían sin normalización final.

## Corrección aplicada
- Se reemplazó la asignación de `area` en las filas pivot para usar `normalizeAreaDisplayName(entry.area)`.
- Se normalizaron también las áreas del catálogo de filtros antes de devolverlas a la UI.

## Conclusión
No era un hardcode visual aislado.
No era únicamente PostgreSQL.
La causa visible estaba en la transformación del backend de Fenograma al construir los datos que consume el frontend.
> LEGACY / reference only. No usar este documento como fuente viva de crecimiento.
