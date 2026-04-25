# Programa Drench

## Objetivo de esta etapa

Construir el programa de Drench dentro de CoreX sin depender del archivo Excel operativo, llevando la logica funcional al sistema y dejando maestros administrables desde la aplicacion.

En esta etapa el foco es el primer pilar de la solucion:

- maestro de productos Drench
- ubicacion funcional en `Gestion / Campo / Administrar Maestros`
- persistencia backend en `db_camp.public`
- estructura SCD2 similar a los maestros existentes del sistema

## Contexto funcional levantado desde el Excel

Archivo de referencia analizado:

- `\\10.0.2.15\14_produccion\Vigentes\CAMPO\Datos\Fumigación\D-PR-000 (Programa  drench gypsos CV)Rev.2546.xlsx`

Hojas relevantes:

- `Programa Drench`: receta por categoria fenologica
- `Inf Bloques`: maestro operativo del bloque
- `PROGRAMA DRENCH PASO 1`: expansion bloque + receta
- `CALCULO DRENCH EGRESO PASO 2`: explosion por producto
- `CODIGOS D`: maestro de productos Drench
- `RESUMEN DRENCH BODEGA 3`: consolidado para bodega

Conclusiones clave:

- El Excel separa claramente la receta Drench del maestro de productos.
- La hoja `CODIGOS D` funciona como el maestro base que define atributos operativos del producto.
- La programacion final por bloque necesita un maestro persistente propio del sistema y no depender de columnas manuales en Excel.

## Decision de arquitectura

Se crea un maestro nuevo e independiente para Drench:

- frontend: `Gestion / Campo / Administrar Maestros / Productos Drench`
- backend: tablas nuevas en `db_camp.public`
- modelo: historial SCD2 con version vigente + trazabilidad

Importante:

- no se reutiliza la ubicacion funcional de `Gestion / Postcosecha / Administrar Maestros`
- no se mezcla con el maestro de SKU de postcosecha
- solo se reutiliza el patron tecnico de persistencia y CRUD

## Campos base del maestro de productos Drench

Campos levantados del Excel y llevados al sistema:

- `productName`
- `productCode`
- `unit`
- `utilization`
- `warehouseAvailability`
- `applicationDay`
- `applicationPh`
- `reentryHours`
- `applicationReason1`
- `applicationReason2`
- `applicationReason3`
- `applicationReason4`
- `activeIngredient`
- `toxicologicalCategory`
- `toxicologicalDescription`
- `agrochemicalOrder`
- `predisposition`
- `referenceDose`
- `withholdingPeriod`
- `changeReason`

## Persistencia

Base destino:

- `db_camp.public`

Tablas nuevas del maestro Drench:

- `public.field_ref_drench_product_id_core_scd2`
- `public.field_dim_drench_product_profile_scd2`

Reglas de persistencia:

- cada creacion genera una version vigente nueva
- cada modificacion cierra la version anterior e inserta una nueva
- se conserva `valid_from`, `valid_to`, `run_id`, `actor_id`, `change_reason`

## Alcance implementado en esta etapa

- documentacion inicial del programa Drench
- maestro CRUD de productos Drench en CoreX
- nueva ruta funcional bajo Campo
- API propia protegida por permisos
- tablas nuevas en `db_camp.public`

## Siguientes pasos

1. Poblar el maestro inicial de productos Drench.
2. Construir el maestro de recetas Drench por categoria fenologica.
3. Mapear `Inf Bloques` al `cycle_profile` del sistema.
4. Generar la programacion semanal por bloque y producto.
5. Resolver la separacion por area una vez estabilizada la logica comun.

## Nota operativa

Este README se mantiene como bitacora viva del programa Drench. Cada cambio relevante de logica, datos o arquitectura debe quedar registrado aqui o en documentos complementarios de la carpeta `docs/drench`.
