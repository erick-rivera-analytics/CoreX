# Postcosecha Productividad - Arquitectura Base

Documento tecnico-operativo para llevar el KPI de `horas / caja` de postcosecha al CoreX usando fuentes reales de PostgreSQL, sin depender del parquet intermedio del proyecto Python.

## Objetivo del modulo

Construir un modulo analitico equivalente a `Campo / KPI / Productividad`, pero para postcosecha, con grano principal por `fecha_post` y no por `cycle_key`.

Ruta objetivo en CoreX:

- `Analitica / Postcosecha / Indicadores & KPI / Productividad`
- sugerencia de ruta: `/dashboard/postcosecha/productividad`

## Alcance funcional inicial

KPIs iniciales:

- `hours_per_box`
- `effective_hours`
- `boxes10`
- desglose por:
  - `area_id` (`CLS`, `SB`, `EMP`)
  - `path_post`
  - `final_destination`
  - `variety_canon`
  - `cost_area`
  - `sub_cost_center`
  - `activity_id`
  - `activity_name`

Pendiente funcional de UI:

- definir si `fecha_post`, `path_post`, `final_destination` y `variety_canon` se usan principalmente como filtros o como primeras columnas de la tabla base
- por ahora la arquitectura asume que esos campos deben existir en ambas capas: filtro y tabla

## Fuentes reales validadas

### Horas

Fuente operativa validada:

- `slv.prod_fact_hours_cur`

Dimension actual de actividades:

- `slv.prod_dim_activity_profile_scd2`

Columnas validadas y disponibles:

- `work_date`
- `event_id`
- `hours_event_id`
- `person_id`
- `area_id`
- `block_id`
- `cycle_key`
- `activity_id`
- `actual_hours`
- `effective_hours`
- `units_produced`
- `start_time`
- `end_time`
- `is_valid`

### Balanzas / flujo postcosecha

Fuentes operativas validadas:

- `slv.prod_fact_balanza_1_cur`
- `slv.prod_fact_balanza_1a_cur`
- `slv.prod_fact_balanza_1c_cur`
- `slv.prod_fact_balanza_2_cur`
- `slv.prod_fact_balanza_2a_cur`
- `slv.prod_fact_balanza_3_cur`

Columnas clave confirmadas:

- `B1`: `work_date`, `cycle_key`, `block_id`, `variety`, `destination`, `grade`, `stems_count`, `camp_weight`, `net_weight`
- `B1A`: `work_date`, `origin`, `destination`, `grade`, `product_type`, `stems_count`, `scale_weight`
- `B1C`: `work_date`, `origin_date`, `activity_id`, `variety`, `destination`, `process`, `grade`, `stems_count`, `net_weight`
- `B2`: `delivered_date`, `origin_date`, `origin`, `destination`, `variety`, `peel_type`, `grade`, `stems_count`, `net_weight`
- `B2A`: `work_date`, `origin_date`, `person_id`, `origin`, `activity_id`, `variety`, `grade`, `net_weight`, `stems_count`, `bunches_count`
- `B3`: `work_date`, `sku`, `lot`, `grade`, `net_weight`, `stems_count`, `bunches_count_procona`

### Capa analitica ya existente en CoreX

El modulo actual de `Postcosecha / Balanzas` ya consume materializadas reales del DW:

- `gld.mv_camp_ind_bal_*`

Estas materializadas confirman que el flujo `B1 -> B1C -> B2 -> B2A` y `B1 -> B1A -> B2 -> B3` ya esta parcialmente modelado en PostgreSQL.

## Conclusion tecnica de fuentes

No falta la data base.

Lo que faltaba para construir el KPI en CoreX era una capa SQL canonica que reemplazara la logica hoy materializada en:

- `fact_post_step_real.parquet`
- `_lib_b2_fix.py`
- `cls_activity_path_master.csv`
- `sb_activity_path_master.csv`
- `emp_activity_path_master.csv`

Ese reemplazo ya quedo planteado en SQL dentro de:

- [datalakehouse_postharvest_productivity.sql](C:/Users/paul.loja/AppData/Local/Temp/CoreX_bodega_validate/sql/datalakehouse_postharvest_productivity.sql)

Adicionalmente, la metodologia operativa `CLS/SB/EMP` ya debe dejar de depender solo de CSV externo y queda formalizada en:

- `db_postharvest.public.postharvest_ref_productivity_rule_id_core_scd2`
- `db_postharvest.public.postharvest_dim_productivity_rule_profile_scd2`

Seed actual:

- [seed-postharvest-productivity-rules.mjs](C:/Users/paul.loja/AppData/Local/Temp/CoreX_bodega_validate/scripts/seed-postharvest-productivity-rules.mjs)

Para que las materializadas del DW puedan usar esas reglas sin depender de joins entre bases, tambien se deja un espejo analitico en:

- `datalakehouse.gld.prod_dim_postharvest_productivity_rule_cur`

Sync actual:

- [sync-postharvest-productivity-rules-to-datalakehouse.mjs](C:/Users/paul.loja/AppData/Local/Temp/CoreX_bodega_validate/scripts/sync-postharvest-productivity-rules-to-datalakehouse.mjs)

## Arquitectura SQL propuesta

Regla del proyecto validada:

- las APIs analiticas de CoreX consumen `gld.mv_*_cur`
- no conviene dejar el contrato final del modulo en `gld.vw_*`
- si se necesita una capa intermedia de desarrollo, puede existir como helper temporal, pero el visualizador debe leer materializadas

### Vista 1 - horas base

Nombre:

- `gld.mv_prod_postharvest_capacity_hours_cur`

Rol:

- normalizar las horas de `CLS`, `SB`, `EMP`
- enriquecer cada fila con la dimension actual de actividad
- separar filas productivas vs soporte

Estado:

- ya implementada en SQL blueprint

### Vista helper - horas por lado del flujo

Nombre:

- `gld.mv_prod_postharvest_rule_side_hours_cur`

Rol:

- tomar `mv_prod_postharvest_rule_hours_cur` como base de reglas vigentes
- separar `effective_hours` entre `hours_upstream` y `hours_downstream`
- dejar trazable la estrategia usada antes del reparto fino de `hours_box_detail`

Columnas clave:

- `work_date`
- `rule_scope_area`
- `rule_id`
- `activity_id`
- `split_strategy`
- `upstream_share_raw`
- `downstream_share_raw`
- `hours_upstream`
- `hours_downstream`

Reglas especiales ya previstas:

- `EMP` va 100% a downstream
- `CLS` soporte `KG_CAPACIDAD` usa el modelo de estaciones con `M` empirico y segmentos de personas
- `CLS` mixto con `TALLOS_CAPACIDAD` y multiples reglas por actividad usa `M_tallos productividad`
- `SB` y el resto de mixtos usan masa diaria `upstream/downstream`
- `applies_to` corta el lado no permitido aunque exista share teorico

Estado:

- ya implementada en SQL blueprint

Fuente:

- `slv.prod_fact_hours_cur`
- `slv.prod_dim_activity_profile_scd2`

### Vista 2 - flujo canonico de pasos

Nombre:

- `gld.mv_prod_postharvest_step_flow_cur`

Rol:

- reemplazar la dependencia de `fact_post_step_real.parquet`
- devolver una fila canonica por paso de flujo con:
  - `post_date`
  - `lot_date`
  - `path_post`
  - `step_code`
  - `variety_canon`
  - `grade_code`
  - `grade_int`
  - `final_destination`
  - `stems_count`
  - `weight_kg`
  - `bunches_count`
  - `person_id` cuando aplique
  - `activity_id` cuando aplique

Estado:

- ya implementada en SQL blueprint

Reglas criticas ya fijadas:

- `B1` y `B1C` toman `path_post` desde `destination`
- `B1A` se fuerza a `PRECLASIFICACION`
- `B2` ya no se resuelve solo por `origin`
  - `peel_type = 'PELADO' -> PRECLASIFICACION`
  - `origin = 'APERTURA' -> APERTURA`
  - `origin = 'GVPELADO'` o `origin like '%GV%' -> GV`
- `B2A` resuelve `final_destination` desde `activity_id` y `activity_name`
- `B3` infiere `variety_canon` y `final_destination` desde `sku`
- `B2A` y `B3` multiplican tallos por bunches cuando aplica

Reglas de variedad incluidas:

- `XL`, `XLE`, `GYPXLE`, `XLENCE` -> `XLE`
- `CLO`, `GYPCLO`, `CLOUD` -> `CLO`
- `ZIN`, `ZZ`, `GYPZZ`, `ZINZI` -> `ZIN`

Flags operativos incluidos:

- `is_allowed_path`
- `is_allowed_destination`
- `is_projected_only_variety`

### Vista helper - universos diarios

Nombre:

- `gld.mv_prod_postharvest_day_universe_cur`

Rol:

- consolidar universos diarios que usa la metodologia de reparto
- dejar precalculados:
  - `cls_upstream_stems = B1C + B1A`
  - `cls_downstream_stems = B2`
  - `sb_upstream_stems = B1`
  - `sb_downstream_stems = B2`
  - `emp_final_weight_kg = B2A + B3`
  - `emp_final_bunches = B2A + B3`

Estado:

- ya implementada en SQL blueprint

### Vista helper - salida final del lote

Nombre:

- `gld.mv_prod_postharvest_lot_final_output_cur`

Rol:

- consolidar la salida final del lote hacia `fecha_post`
- unificar `B2A` y `B3`
- exponer `share_kg_to_post_date` por:
  - `lot_date`
  - `post_date`
  - `path_post`
  - `variety_canon`
  - `final_destination`

Estado:

- ya implementada en SQL blueprint

### Vista helper - universo del periodo

Nombre:

- `gld.mv_prod_postharvest_period_universe_cur`

Rol:

- consolidar el universo del periodo por `path_post` y `final_destination`
- dejar listas las participaciones para metodologias:
  - `KG`
  - `KG_CAPACIDAD`
  - `BUNCHES`
  - `TALLOS_DIRECT`
  - `TALLOS_CAPACIDAD`

Columnas clave:

- `final_weight_kg`
- `final_bunches`
- `b2_stems`
- `share_final_weight`
- `share_final_bunches`
- `share_b2_stems`

Estado:

- ya implementada en SQL blueprint

### Vista helper - horas por regla

Nombre:

- `gld.mv_prod_postharvest_rule_hours_cur`

Rol:

- cruzar la capa de horas base con las reglas vigentes ya espejadas en `datalakehouse`
- dejar una fila por `work_date + rule_id + activity_id`
- servir como base inmediata para el reparto fino de `hours_box_detail`

Columnas clave:

- `work_date`
- `rule_scope_area`
- `rule_id`
- `activity_id`
- `path_rule`
- `methodology_code`
- `stage_side`
- `anchor_final`
- `effective_hours`
- `actual_hours`
- `units_produced`
- `distinct_people`

Estado:

- ya implementada en SQL blueprint

### Vista 3 - detalle horas/caja

Nombre propuesto:

- `gld.mv_prod_postharvest_hours_box_detail_cur`

Grano objetivo:

- una fila por:
  - `post_date`
  - `path_post`
  - `final_destination`
  - `lot_date`
  - `variety_canon`
  - `area_id`
  - `cost_area`
  - `sub_cost_center`
  - `activity_id`

Columnas esperadas:

- `effective_hours_assigned`
- `weight_kg`
- `boxes10`
- `hours_per_box`
- `match_kind`
- `stage_side`
- `allocation_method`

Estado:

- ya implementada en SQL blueprint

Semantica importante de esta capa:

- `SPECIFIC` ya aterriza a `post_date` real del lote
- `SPECIFIC_PERIOD` y `FALLBACK_MACRO` se conservan compactadas con `post_date = work_date` como placeholder
- esa decision replica el motor Python para evitar explosion de filas en detalle
- la redistribucion de esas filas placeholder a `post_date` real queda para la capa agregada `mv_prod_postharvest_hours_box_cur`
- para rules `MIXED`, el split de horas se calcula primero y el `applies_to` solo enmascara el lado permitido
- no se debe renormalizar una fila `UPSTREAM` o `DOWNSTREAM` a `100%` de horas
- esa renormalizacion fue la causa del sobreconteo de `CLS` en `SFM`, `RVM` y `PAM`
- `path_rule = 'PENDING'` debe quedar fuera de la capa analitica porque contamina `SB` y altera `rule_count`

Motivo de la separacion:

- aqui vive la metodologia pesada de reparto
- no conviene mezclar esa numerica con la vista de flujo base

### Vista 4 - agregado CoreX

Nombre propuesto:

- `gld.mv_prod_postharvest_hours_box_cur`

Rol:

- servir directamente al modulo CoreX
- concentrar el agregado visible por `fecha_post`
- exponer filtros y KPIs ya listos para la UI

Estado:

- implementada en SQL blueprint

Grano final:

- una fila por:
  - `post_date`
  - `path_post`
  - `final_destination`
  - `variety_canon`
  - `area_id`

Columnas clave:

- `weight_kg`
- `boxes10`
- `effective_hours_assigned`
- `effective_hours_upstream`
- `effective_hours_downstream`
- `effective_hours_specific`
- `effective_hours_specific_period`
- `effective_hours_fallback_macro`
- `effective_hours_fallback_day`
- `hours_per_box`
- `hours_per_box_upstream`
- `hours_per_box_downstream`

Regla importante de esta capa:

- `SPECIFIC_PERIOD` y `FALLBACK_MACRO` se redistribuyen aqui sobre los `post_date` reales del universo `kg_post`
- la redistribucion ocurre por share de `peso_kg` dentro de cada `(path_post, final_destination)`
- por eso la capa final no baja a `variety_canon` ni `lot_date`; ese detalle queda reservado a `gld.mv_prod_postharvest_hours_box_detail_cur`

## Estrategia recomendada

Si conviene materializar ambas capas principales:

1. `gld.mv_prod_postharvest_step_flow_cur`
   - capa de flujo operativa reutilizable
   - sirve para debugging, auditoria y futuras metricas
2. `gld.mv_prod_postharvest_day_universe_cur`
   - helper directo para `CLS`, `SB`, `EMP`
3. `gld.mv_prod_postharvest_lot_final_output_cur`
   - helper para viaje de `lot_date` a `post_date`
4. `gld.mv_prod_postharvest_period_universe_cur`
   - helper para reparto proporcional del periodo
5. `gld.mv_prod_postharvest_rule_side_hours_cur`
   - helper para separar horas upstream/downstream por regla
6. `gld.mv_prod_postharvest_hours_box_detail_cur`
   - detalle granular con `SPECIFIC`, `SPECIFIC_PERIOD`, `FALLBACK_MACRO` y `FALLBACK_DAY`
7. `gld.mv_prod_postharvest_hours_box_cur`
   - capa final de consumo para CoreX

Con esto el drill-down por `activity_id` ya queda en la capa materializada, sin recalcular la logica pesada.

## Orden de refresh recomendado

1. `gld.mv_prod_postharvest_capacity_hours_cur`
2. `gld.mv_prod_postharvest_step_flow_cur`
3. `gld.mv_prod_postharvest_day_universe_cur`
4. `gld.mv_prod_postharvest_lot_final_output_cur`
5. `gld.mv_prod_postharvest_period_universe_cur`
6. `gld.mv_prod_postharvest_rule_hours_cur`
7. `gld.mv_prod_postharvest_rule_side_hours_cur`
8. `gld.mv_prod_postharvest_hours_box_detail_cur`
9. `gld.mv_prod_postharvest_hours_box_cur`

## Indices minimos sugeridos

Para `gld.mv_prod_postharvest_step_flow_cur`:

- `(post_date)`
- `(lot_date)`
- `(path_post, final_destination)`
- `(variety_canon)`
- `(step_code)`

Para `gld.mv_prod_postharvest_hours_box_detail_cur`:

- `(post_date)`
- `(area_id, path_post, final_destination, variety_canon)`
- `(activity_id)`
- `(cost_area, sub_cost_center)`

## Pendientes controlados antes del modulo CoreX

- definir la metodologia exacta de reparto de horas para `CLS`, `SB`, `EMP`
- decidir si `fecha_post`, `path_post`, `final_destination`, `variety_canon` se priorizan como filtros, columnas base o ambas
- migrar las reglas hoy mantenidas en CSV/XLSX a una fuente formal en PostgreSQL si van a seguir siendo parte del modelo operativo

## Baseline de validacion

- el KPI historico `4.0852 h/caja` de `2025-04-29` a `2026-05-02` no representa la fuente viva actual de PostgreSQL
- ese numero salio de una corrida Python con cajas hasta `2026-05-02`, pero con snapshot de horas que llegaba solo hasta `2026-04-15`
- contra la fuente viva actual, el baseline operativo correcto del mismo rango es `4.3716 h/caja`
- la paridad de la migracion SQL debe medirse contra ese baseline vivo mientras no exista otra foto oficial congelada

## Regla de fuente en CoreX

- el modulo `Analitica / Postcosecha / Indicadores & KPI / Productividad` debe consumir solo PostgreSQL
- no se deben mezclar parquets del proyecto fuente dentro del visual de CoreX
- si la familia `mv_prod_postharvest_*` esta reconstruyendose y la materializada final no existe, la pantalla debe devolver un mensaje claro de rebuild en curso
