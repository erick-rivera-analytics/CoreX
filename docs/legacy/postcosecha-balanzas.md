> LEGACY / reference only.

# Poscosecha Balanzas

## 1. Objetivo

Este modulo monta una lectura operativa del flujo BPMN de postcosecha para la rama:

- `Apertura -> Apertura pelado patas -> BAL2 -> BAL2A`

No instrumenta todo el BPMN. Solo se pintan los nodos y tramos que hoy tienen vista materializada valida en PostgreSQL.

## 2. Rutas y archivos activos

### Vista

- `src/app/(dashboard)/dashboard/postcosecha/balanzas/page.tsx`
- `src/components/dashboard/balanzas-explorer.tsx`
- `src/components/dashboard/balanzas-process-viewer.tsx`
- `src/components/dashboard/balanzas-grouped-table.tsx`

### API

- `src/app/api/postcosecha/balanzas/route.ts`

### Dominio

- `src/lib/postcosecha-balanzas.ts`

## 3. Fuentes de datos

### Tramo 1

- `gld.mv_camp_ind_bal_apertura_b1_vs_b1c_peso_xl_np_cur`
- `gld.mv_camp_ind_bal_apertura_b1_vs_b1c_tallos_xl_np_cur`

Representa:

- `BAL1 vs BAL1C`
- rama BPMN: `Apertura -> Apertura pelado patas`

### Tramo 2

- `gld.mv_camp_ind_bal_apertura_b1c_vs_b2_peso_xl_np_cur`
- `gld.mv_camp_ind_bal_apertura_b1c_vs_b2_tallos_xl_np_cur`

Representa:

- `BAL1C vs BAL2`
- rama BPMN: `Apertura pelado patas -> BAL2`

### Tramo 3

- `gld.mv_camp_ind_bal_apertura_b2_vs_b2a_peso_xl_np_cur`

Representa:

- `BAL2 vs BAL2A`
- rama BPMN: `BAL2 -> BAL2A`
- desdoble visual por `Arcoiris`, `Tinturado` y `Blanco`

No existe hoy vista equivalente de `tallos` para `BAL2 -> BAL2A`, por eso ese nodo puede quedar no disponible cuando la metrica activa es `tallos`.

## 4. Indicador macro por tramo

### BAL1 vs BAL1C

- en detalle crudo por fila se usa `diff_weight` o `diff_stems` cuando la vista lo trae
- en resumen agregado se usa `BAL1C / BAL1 - 1`

### BAL1C vs BAL2

- en detalle crudo por fila se usa `hidr_pct` o `diff_pct_stems` cuando la vista lo trae
- en resumen agregado se usa `BAL2 / BAL1C - 1`

### BAL2 vs BAL2A

- en detalle crudo por fila se usa `desp_pct_peso`
- en resumen agregado se usa `BAL2A / BAL2 - 1`

## 5. Filtros globales

El tablero global filtra solo por fecha de trabajo:

- `Anios`
- `Meses`
- `Dia`
- `Semana`
- `Fecha desde`
- `Fecha hasta`

Reglas:

- solo se usa `Semana ISO`
- si no se selecciona semana, se toma automaticamente la ultima disponible
- los filtros globales afectan el BPMN, el resumen del nodo y el detalle del nodo

## 6. Filtros locales del modal

Cada nodo abre una ventana flotante con filtros propios segun las columnas reales de la vista:

- `Semana`
- `Dia`
- `Fecha`
- `Lote`
- `Grado`
- `Dias de hidratacion`
- `Destino interno`

Reglas:

- `Destino interno` no se muestra cuando no aporta
- en `BAL1 vs BAL1C` todo cae en `Apertura`, por eso no se expone
- en `BAL2 vs BAL2A` el click desde el BPMN ya abre el modal filtrado por la rama elegida

## 7. Resumen superior del modal

Las tarjetas superiores del modal no toman el total bruto del nodo. Se recalculan con las filas visibles despues de:

1. filtros globales
2. rama clickeada en el BPMN
3. filtros locales del modal
4. busqueda libre dentro del nodo

Eso garantiza que el resumen visible siempre coincida con la tabla cruda y la tabla agrupada.

## 8. Tabla agrupada y detalle crudo

Ambas vistas siguen las mismas reglas:

- nombres visibles en espanol
- si la metrica es `peso`, los totales y brechas se muestran con `kg`
- el macro indicador siempre se presenta como porcentaje
- no se repite la columna cruda del indicador (`diff_weight`, `hidr_pct`, `desp_pct_peso`) cuando ya esta representada como `Macro indicador`

## 9. Comportamiento del BPMN

- el diagrama usa `bpmn-js`
- cada overlay vive sobre el elemento exacto del BPMN correspondiente al tramo real
- `BAL2 -> BAL2A` se desdobla visualmente en:
  - `Arcoiris`
  - `Tinturado`
  - `Blanco`

Al hacer click:

- se abre el modal del nodo
- en `BAL2 -> BAL2A` se precarga el filtro local del destino clickeado

## 10. Validacion recomendada

Antes de subir cambios en este modulo:

```bash
npm run typecheck
npm run lint
npm run build
```
> LEGACY / reference only. La fuente vigente es el codigo del modulo y los docs oficiales.
