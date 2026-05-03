# Migracion Tecnica: Storageroom, Laboratory y Drench Weekly Planning

## Alcance
Este documento consolida los cambios tecnicos aplicados sobre la rama `codex/bodega-drench-maestros` para dejar operativos:

- maestros de `Storageroom` antes llamados `Bodega`
- maestros de `Laboratory`
- maestro de `Programacion Drench`
- calendarizacion semanal de Drench para consumo de `Gestion / Bodega / Planificacion / Programaciones`
- exportacion PDF semanal de programaciones Drench

El objetivo es que una futura migracion o reconstruccion del entorno pueda reproducir la estructura fisica, las reglas de calculo y las dependencias de runtime sin depender de contexto oral.

## Commits relevantes
Sobre la rama `codex/bodega-drench-maestros`, esta linea de trabajo quedo repartida en estos commits:

- `c2d586f` - `Refactor bodega masters and add drench programming`
- `3d1dc31` - `Refine drench program hierarchy and bodega linkage`
- `296d016` - `Add laboratory masters and weekly drench planning view`
- `f3c79b6` - `Refine drench dosage logic and export weekly planning PDFs`

## Bases de datos objetivo
La arquitectura final separa origenes asi:

- `db_storageroom`
  - maestros de productos, unidades, categorias, usos y presentaciones de Storageroom
- `db_laboratory`
  - maestros de productos de laboratorio, categorias, actividades aplicables y lineas de receta
- `db_camp`
  - maestro de Programacion Drench
  - lineas de Drench
  - calendario semanal resuelto por vista de lectura

### Importante
- `db_warehouse`, `db_bodega` y `db_laboratorio` no deben quedar como origen operativo final.
- el runtime del proyecto debe resolver:
  - `BODEGA_DATABASE_NAME=db_storageroom`
  - `LABORATORY_DATABASE_NAME=db_laboratory`
  - `CAMP_DATABASE_NAME=db_camp`

## Convenciones fisicas
La nomenclatura fisica vigente queda:

- `sr_` para tablas de `db_storageroom`
- `lab_` para tablas de `db_laboratory`
- `field_` para tablas de `db_camp` ya existentes del dominio Drench

### Tablas vigentes de Storageroom
En `db_storageroom.public`:

- `sr_ref_unit_id_core_scd2`
- `sr_dim_unit_profile_scd2`
- `sr_ref_category_id_core_scd2`
- `sr_dim_category_profile_scd2`
- `sr_ref_product_id_core_scd2`
- `sr_dim_product_profile_scd2`
- `sr_bridge_product_usage_scd2`
- `sr_ref_product_presentation_id_core_scd2`
- `sr_dim_product_presentation_profile_scd2`

### Tablas vigentes de Laboratory
En `db_laboratory.public`:

- `lab_ref_category_id_core_scd2`
- `lab_dim_category_profile_scd2`
- `lab_ref_product_id_core_scd2`
- `lab_dim_product_profile_scd2`
- `lab_bridge_product_usage_scd2`
- `lab_bridge_product_recipe_line_scd2`

### Tablas vigentes de Drench
En `db_camp.public`:

- `field_ref_drench_program_rule_id_core_scd2`
- `field_dim_drench_program_rule_profile_scd2`
- `field_bridge_drench_program_rule_line_scd2`

## Modulos CoreX impactados

### Storageroom
Rutas:

- `/dashboard/bodega/administrar-maestros/productos`
- `/dashboard/bodega/administrar-maestros/unidades`
- `/dashboard/bodega/administrar-maestros/categorias`
- `/dashboard/bodega/administrar-maestros/presentaciones-conversiones`

Capas principales:

- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\bodega-db.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\bodega-masters.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\bodega-master-types.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\bodega-activity-source.ts`

### Laboratory
Ruta:

- `/dashboard/laboratorio/administrar-maestros/receta-productos`

Capas principales:

- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\laboratory-db.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\laboratory-masters.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\laboratory-master-types.ts`

### Drench master
Ruta:

- `/dashboard/campo/administrar-maestros/programacion-drench`

Capas principales:

- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\campo-drench-program.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\campo-drench-program-types.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\modules\campo\components\campo-drench-program-page.tsx`

### Bodega weekly planning
Ruta:

- `/dashboard/bodega/planificacion/programaciones`

Capas principales:

- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\drench-week-calendar.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\modules\bodega\components\bodega-programaciones-page.tsx`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\modules\bodega\components\bodega-programaciones-explorer.tsx`
- `src/app/api/bodega/planificacion/programaciones/route.ts`
- `src/app/api/bodega/planificacion/programaciones/pdf/route.ts`

## Modelo funcional de Drench

### Grupo base
El grupo base es una agrupacion visual y operativa por:

- `variety_code`
- `cycle_type`

Ejemplos:

- `CLO / Poda`
- `CLO / Siembra`
- `XL / Poda`
- `ZIN / Siembra`

El grupo base no tiene tabla propia; se deriva de las semanas vigentes.

### Semana fenologica
Cada semana es una regla real en `field_dim_drench_program_rule_profile_scd2`.

Campos funcionales minimos:

- `rule_id`
- `rule_code`
- `phenological_week`
- `cycle_type`
- `variety_code`
- `activity_id`
- `is_current`
- `is_valid`

### Linea de aplicacion
Cada linea vive en `field_bridge_drench_program_rule_line_scd2` y soporta:

- origen del producto
- producto homologado
- cantidad de producto
- referencia de cantidad
- base de calculo
- litros por cama cuando aplica

Campos funcionales clave:

- `product_origin`
- `product_id`
- `laboratory_product_id`
- `source_product_code`
- `source_product_name`
- `source_unit_code`
- `product_quantity_value`
- `product_quantity_reference`
- `dosage_basis`
- `liters_per_bed`
- `method_name`

## Origen de producto en Drench
Cada linea soporta dos origenes:

- `BODEGA`
- `LABORATORIO`

### Origen BODEGA
La linea debe apuntar a `product_id` de Storageroom.

La UI solo debe listar productos con actividad `FM11`.

La homologacion debe sobreescribir desde el maestro:

- codigo
- nombre
- unidad

### Origen LABORATORIO
La linea debe apuntar a `laboratory_product_id` de Laboratory.

Los productos iniciales homologados fueron:

- `FB996 - PAECILOMYCES`
- `FB998 - BEAUVERIA`
- `FB999 - TRICHODERMA`

La homologacion tambien debe sobreescribir desde el maestro:

- codigo
- nombre
- unidad

## Base de calculo de dosis
La enumeracion vigente es:

- `PER_LITER`
- `PER_BED`
- `PER_1000_LITERS`

### Regla `PER_LITER`
Se usa cuando la dosis es por litro.

Formula:

- `liters_block = liters_per_bed * bed_count_30m2`
- `product_total = product_quantity_value * liters_block`

### Regla `PER_BED`
Se usa solo para dosis por cama o unidad directa.

Formula:

- `product_total = product_quantity_value * bed_count_30m2`

### Regla `PER_1000_LITERS`
Se usa para productos de laboratorio tipo fundas por tanque de `1000L`.

Formula:

- `liters_block = liters_per_bed * bed_count_30m2`
- `product_total = product_quantity_value * (liters_block / 1000)`

### Caso de Laboratory
Los productos de laboratorio quedaron normalizados con:

- `source_unit_code = FUN`
- `dosage_basis = PER_1000_LITERS`
- `product_quantity_reference = CANTIDAD EN FUNDAS / 1000L`

Esto reemplaza la interpretacion incorrecta previa de `PER_BED`.

## Calendarizacion semanal de Drench

### Vista SQL
La vista de trabajo es:

- `slv.camp_v_drench_week_calendar_cur`

Script de recreacion:

- `X:\PROYECTOS\PLANIFICACION\CoreX\scripts\init-drench-week-calendar-view.py`

### Metodologia
La programacion para bodega se arma por `ISO week`, pero la semana fenologica se resuelve con la fecha ancla del jueves de la semana objetivo.

Reglas:

- `publication_date = jueves de la semana anterior`
- `anchor_date = jueves de la semana objetivo`
- `phenological_week = floor((anchor_date - sp_date) / 7) + 1`

### Nota futura
Pendiente explicito del proyecto:

- migrar esta calendarizacion para anclarla a la base de vegetativo, que ya contiene la calendarizacion operativa real por bloque
- la granularidad correcta a futuro debe ser diaria, no solo semanal

## Calculo de `# Camas 30m2`
No debe salir de `bed_count`.

La regla correcta en la vista es:

- `bed_count_30m2 = bed_area / 30`

Esto se ajusto para empatar con el Excel de planificacion.

## Vista de Bodega / Planificacion / Programaciones
Existen dos modos:

- `Por bloque`
- `Por producto / bloque`

### Vista `Por bloque`
Muestra:

- `cycle_id`
- `bloque`
- `semana_iso`
- `categoria_fenologica`
- `# camas 30m2`
- `receta por bloque`

### Vista `Por producto / bloque`
Muestra primero subtotales por producto y permite expandir el detalle por bloque, siguiendo la logica de subtotal usada en `Productividad`.

Nivel resumen:

- `codigo`
- `producto`
- `bloques`
- `cantidad`

Nivel detalle:

- `bloque`
- `cantidad`

## Exportacion PDF de programaciones
Ruta:

- `POST /api/bodega/planificacion/programaciones/pdf`

Sistema:

- **pdf-canon (LaTeX / pdflatex)** — usa `generateCanonicalPdf` igual que Solver y Seguimientos.
- Template: `pdf-canon/templates/bodega_programacion_drench.tex` (landscape A4).
- Helpers: `pdf-canon/scripts/generate_pdf_service.ts`.
- Logo institucional: `pdf-canon/assets/logo.pdf` (StarFlowers).

> **Histórico:** la versión anterior usaba Python + reportlab y un path
> hardcodeado a la máquina de un dev. Migrado a pdf-canon en 2026-05 para
> que funcione en producción sin Python instalado en el servidor.

### Payload soportado

```json
{
  "filters": {
    "isoWeekId": "2619",
    "cycleType": "",
    "variety": "",
    "areaId": ""
  },
  "selectedGroupKey": "",
  "viewMode": "by-block"
}
```

### Comportamiento
- toma la `isoWeekId` seleccionada en pantalla
- soporta `selectedGroupKey` para exportar un grupo base filtrado
- soporta:
  - `by-block`
  - `by-product-block`

### PDF `by-product-block`
Se arma en dos secciones:

1. resumen general por producto
2. detalle por producto y bloque

## Reglas de versionado SCD2
La politica funcional aplicada es:

- una edicion cierra la version actual con:
  - `is_current = false`
  - `valid_to = timestamp`
- la nueva version entra con:
  - `is_current = true`
  - `is_valid = true`

Las eliminaciones logicas usan:

- `is_current = false`
- `is_valid = false`

Esto aplica tanto para:

- eliminacion de semana
- eliminacion de grupo base

No debe haber borrado fisico de historial.

## Validaciones de consistencia recomendadas

### Storageroom
Validar que existan datos vigentes:

```sql
select count(*) from public.sr_dim_product_profile_scd2 where is_current and is_valid;
select count(*) from public.sr_dim_unit_profile_scd2 where is_current and is_valid;
select count(*) from public.sr_dim_category_profile_scd2 where is_current and is_valid;
```

### Laboratory
Validar catalogo inicial:

```sql
select product_code, product_name
from public.lab_dim_product_profile_scd2
where is_current and is_valid
order by product_code;
```

### Drench
Validar reglas y lineas vigentes:

```sql
select count(*) from public.field_dim_drench_program_rule_profile_scd2 where is_current and is_valid;
select count(*) from public.field_bridge_drench_program_rule_line_scd2 where is_current and is_valid;
```

Validar normalizacion de laboratorio:

```sql
select
  source_product_code,
  source_product_name,
  source_unit_code,
  dosage_basis,
  product_quantity_reference,
  count(*)
from public.field_bridge_drench_program_rule_line_scd2
where is_current and is_valid
  and product_origin = 'LABORATORIO'
group by 1,2,3,4,5
order by 1;
```

### Weekly planning view
Validar lectura por semana:

```sql
select *
from slv.camp_v_drench_week_calendar_cur
where iso_week_id = '2619'
limit 20;
```

## Archivos tocados en esta migracion

### SQL / scripts
- `X:\PROYECTOS\PLANIFICACION\CoreX\scripts\init-drench-week-calendar-view.py`
- `X:\PROYECTOS\PLANIFICACION\CoreX\scripts\generate_drench_program_pdf.py`

### APIs
- `src/app/api/bodega/planificacion/programaciones/route.ts`
- `src/app/api/bodega/planificacion/programaciones/pdf/route.ts`

### Libs
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\campo-drench-program.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\campo-drench-program-types.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\drench-week-calendar.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\bodega-masters.ts`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\lib\laboratory-masters.ts`

### UI
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\modules\campo\components\campo-drench-program-page.tsx`
- `X:\PROYECTOS\PLANIFICACION\CoreX\src\modules\bodega\components\bodega-programaciones-explorer.tsx`

## Riesgos y pendientes

- la vista semanal todavia no consume la calendarizacion final de vegetativo
- `Punto de apertura` no tiene aun una ruta propia de PDF/analisis
- el runtime del NAS puede ser inestable para `next dev`; para validaciones operativas conviene seguir usando la copia local funcional si la carpeta compartida se degrada
- cualquier nueva familia de producto de `Laboratory` debe entrar por el maestro, no por texto libre en Drench

## Recomendacion operativa
Antes de desplegar o migrar otra vez, ejecutar esta secuencia:

1. validar `.env.local`
2. validar existencia de `db_storageroom`, `db_laboratory`, `db_camp`
3. recrear `slv.camp_v_drench_week_calendar_cur`
4. validar catalogos vigentes
5. abrir:
   - `Programacion Drench`
   - `Receta de productos`
   - `Bodega / Planificacion / Programaciones`
6. probar exportacion PDF con una semana conocida, por ejemplo `2619`

Con esta secuencia deberia quedar reconstruible toda la migracion funcional aplicada en esta rama.
