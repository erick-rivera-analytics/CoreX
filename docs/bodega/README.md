# Bodega · Maestro Corporativo de Productos

## Objetivo

Construir en CoreX un maestro corporativo unico de productos e insumos administrado por Bodega, reutilizable por Campo, Poscosecha y futuros programas operativos.

## Decision actual de arquitectura

La estructura correcta queda separada en 5 capas:

1. `Producto`
   - que es el insumo
   - codigo corporativo
   - nombre oficial
   - unidad base
   - categoria
   - componente activo

2. `Catalogo`
   - clasifica el producto en un arbol `Familia > Subfamilia`

3. `Unidad`
   - define la unidad base homologada desde el maestro de Unidades

4. `Presentaciones y conversiones`
   - define las presentaciones comerciales del producto
   - aqui vive el nombre comercial si aplica
   - registra cantidad y unidad por presentacion
   - convierte cada presentacion hacia la unidad base dominante del producto
   - si no existe conversion automatica, exige equivalencia manual antes de guardar

5. `Aplicacion operativa`
   - ya no se guarda como texto libre `Area / Actividad`
   - ahora se guarda por `activity_id`
   - la jerarquia operativa sale de la fuente `slv.prod_dim_activity_profile_scd2`

## Cambio clave respecto al modelo anterior

Antes el prototipo proponia:

- `Area`
- `Actividad`

y el sistema construia una etiqueta combinada.

Eso ya no es la logica correcta.

Ahora:

- el producto se asigna a una o varias actividades fuente
- la actividad ya trae:
  - `activity_id`
  - `activity_name`
  - `cost_area`
  - `sub_cost_center`
  - `activity_type`

Ejemplo:

- `FM11`
- `activity_name = Drench`
- `cost_area = Campo`
- `sub_cost_center = Vegetativo`

Entonces un producto no se registra como:

- `Campo / Drench`

Sino como:

- `activity_id = FM11`

Y CoreX resuelve el resto desde el maestro fuente.

## Fuente operativa

El maestro de actividades no vive en `db_camp`.

La fuente vigente esta en:

- `datalakehouse.slv.prod_dim_activity_profile_scd2`

Columnas relevantes:

- `activity_id`
- `activity_name`
- `cost_area`
- `sub_cost_center`
- `activity_type`
- `unit_of_measure`
- `is_current`
- `is_valid`

## Modelo funcional visible en CoreX

Ruta:

- `Gestion / Bodega / Administrar Maestros / Productos`

El formulario de productos debe trabajar asi:

1. seleccionar `Unidad base` desde el maestro de unidades
2. seleccionar `Rama del catalogo` desde el arbol de categorias
3. marcar `Componente activo`
   - `Si aplica`
   - `No aplica / N-A`
4. agregar una o varias `Actividades aplicables`
   - se buscan por codigo o nombre
   - se guardan por `activity_id`
   - el formulario muestra el centro y subcentro que ya trae la fuente
   - si un producto todavia no tiene actividad definida, puede quedar cargado sin asignacion y completarse despues

## Base en PostgreSQL

Persistencia principal en:

- `db_camp.public`

Tablas creadas para Bodega:

- `bodega_ref_unit_id_core_scd2`
- `bodega_dim_unit_profile_scd2`
- `bodega_ref_category_id_core_scd2`
- `bodega_dim_category_profile_scd2`
- `bodega_ref_product_id_core_scd2`
- `bodega_dim_product_profile_scd2`
- `bodega_bridge_product_usage_scd2`
- `bodega_ref_product_presentation_id_core_scd2`
- `bodega_dim_product_presentation_profile_scd2`

La tabla puente de uso operativo ahora guarda:

- `product_id`
- `branch_order`
- `activity_id`

No guarda:

- `area_name`
- `activity_name`
- `usage_label`

porque esos atributos deben resolverse desde la fuente operativa.

La tabla de presentaciones ahora guarda:

- `product_id`
- `presentation_code`
- `commercial_name`
- `presentation_name`
- `package_name`
- `presentation_quantity`
- `presentation_unit_id`
- `equivalent_base_quantity`
- `conversion_mode`
- `base_unit_id`

## Excel de propuesta

El workbook de propuesta debe servir para 2 cosas:

1. revisar la categoria propuesta por producto
2. preparar la asignacion inicial por `activity_id`

Por eso el archivo incluye:

- hoja de productos
- hojas de familias / subfamilias / ramas
- hoja de actividades fuente para referencia
- columnas editables para que negocio defina que `activity_id` aplica a cada producto

## Pendientes siguientes

- revisar contigo la propuesta de categorias
- revisar contigo la propuesta de actividades asignables por producto
- cuando des `ok`, sembrar la base inicial
- luego habilitar modificaciones desde CoreX sobre ese maestro ya cargado
