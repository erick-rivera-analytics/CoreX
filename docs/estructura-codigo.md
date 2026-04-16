> LEGACY / reference only.

# Estructura del codigo activo

## 1. Objetivo de este documento

Este archivo sirve como inventario del codigo que realmente participa en el proyecto activo. La idea es saber rapido que archivo tocar segun el tipo de cambio que se necesite.

## 2. Criterio de lectura

- `src/` contiene el proyecto activo
- `docs/` contiene la documentacion
- `borrar/` contiene legado archivado

## 3. App Router

## 3.1. Raiz de la app

### `src/app/layout.tsx`

Layout raiz. Monta fuentes, proveedor de tema y estructura general de toda la aplicacion.

### `src/app/page.tsx`

Entrada raiz. Normalmente resuelve la redireccion inicial hacia login o dashboard.

### `src/app/loading.tsx`

Pantalla de carga global para transiciones del router.

### `src/app/not-found.tsx`

Vista 404 del proyecto.

### `src/app/globals.css`

Estilos globales, tokens visuales y look general. Cualquier cambio fuerte de identidad visual suele empezar aqui.

### `src/app/login/page.tsx`

Pantalla de acceso placeholder. No implementa auth real todavia.

## 3.2. Layout del dashboard

### `src/app/(dashboard)/layout.tsx`

Shell principal del dashboard. Monta sidebar, header, footer y contenido.

### `src/app/(dashboard)/dashboard/page.tsx`

Home del dashboard. Resume vistas disponibles y estado general de la base.

### `src/app/(dashboard)/dashboard/fenograma/page.tsx`

Entrada server del modulo `Fenograma`. Hace bootstrap inicial con datos reales.

### `src/app/(dashboard)/dashboard/comparacion/page.tsx`

Vista base de comparacion. Hoy usa seed local.

### `src/app/(dashboard)/dashboard/postcosecha/balanzas/page.tsx`

Entrada server del modulo `Poscosecha Balanzas`. Hace bootstrap inicial del flujo BPMN y sus indicadores reales.

## 3.3. APIs

### `src/app/api/health/db/route.ts`

Health check de PostgreSQL.

### `src/app/api/fenograma/pivot/route.ts`

Devuelve el pivot filtrado de Fenograma.

### `src/app/api/fenograma/block/[parentBlock]/route.ts`

Devuelve perfiles de ciclo por bloque.

### `src/app/api/fenograma/cycle/[cycleKey]/beds/route.ts`

Devuelve detalle de camas por ciclo.

### `src/app/api/postcosecha/balanzas/route.ts`

Devuelve el dashboard de `Balanzas` con filtros temporales, nodos BPMN, detalle de tablas y resumen por tramo.

## 4. Componentes generales

### `src/components/app-sidebar.tsx`

Sidebar jerarquico y colapsable del dashboard.

### `src/components/site-header.tsx`

Header superior del dashboard.

### `src/components/site-footer.tsx`

Footer inferior del shell.

### `src/components/logo.tsx`

Isotipo usado en sidebar y branding.

### `src/components/mode-toggle.tsx`

Control de tema.

### `src/components/theme-provider.tsx`

Proveedor de tema para la app.

## 5. Componentes de dashboard

## 5.1. Fenograma

### `src/components/dashboard/fenograma-explorer.tsx`

Componente cliente principal del modulo. Administra filtros, fetch incremental, apertura del modal y detalle de camas.

### `src/components/dashboard/fenograma-pivot-table.tsx`

Tabla pivoteada con columnas fijas sticky y scroll horizontal sobre semanas.

### `src/components/dashboard/fenograma-weekly-bars-panel.tsx`

Wrapper cliente para cargar dinamicamente la grafica de barras.

### `src/components/dashboard/fenograma-weekly-bars-chart.tsx`

Grafica `Recharts` del acumulado semanal.

### `src/components/dashboard/fenogram-trend-panel.tsx`

Panel de tendencia heredado de la fase seed. Sigue activo como pieza reusable, aunque no es la grafica principal del modulo real actual.

### `src/components/dashboard/fenogram-trend-chart.tsx`

Implementacion `Recharts` del panel de tendencia heredado.

## 5.2. Comparacion

### `src/components/dashboard/comparison-radar-panel.tsx`

Wrapper cliente para el radar comparativo.

### `src/components/dashboard/comparison-radar-chart.tsx`

Grafica radar `Recharts` de la vista de comparacion.

### `src/components/dashboard/metric-card.tsx`

Tarjeta reutilizable para metricas resumen.

## 5.3. Poscosecha Balanzas

### `src/components/dashboard/balanzas-explorer.tsx`

Componente cliente principal del modulo. Administra filtros temporales, fetch incremental, apertura del modal y detalle de nodo.

### `src/components/dashboard/balanzas-process-viewer.tsx`

Renderiza el BPMN con overlays por tramo instrumentado y apertura de detalle al hacer click.

### `src/components/dashboard/balanzas-grouped-table.tsx`

Tabla agrupable del nodo seleccionado. Recalcula resumenes del tramo y permite agrupar por semana, dia, fecha, lote o grado.

## 6. Componentes UI base

### `src/components/ui/button.tsx`

Boton base reutilizable.

### `src/components/ui/card.tsx`

Tarjeta base reutilizable.

### `src/components/ui/badge.tsx`

Badge base reutilizable.

### `src/components/ui/input.tsx`

Input base reutilizable.

### `src/components/ui/label.tsx`

Label base reutilizable.

### `src/components/ui/multi-select-field.tsx`

Selector multivalor reutilizable con panel flotante renderizado sobre `body`.

## 7. Configuracion, contextos y hooks

### `src/config/dashboard.ts`

Centro de configuracion de branding, vistas, sidebar y contexto de pagina.

### `src/contexts/theme-context.ts`

Contexto para tema visual.

### `src/hooks/use-theme.ts`

Hook auxiliar para consumir tema.

## 8. Librerias de dominio e infraestructura

### `src/lib/db.ts`

Conexion a PostgreSQL, resumen de configuracion, pool y helper `query()`.

### `src/lib/fenograma.ts`

Dominio principal del modulo real actual. Contiene:

- tipos
- filtros por default
- normalizacion de filtros
- armado del `where`
- consulta pivoteada
- resumen semanal
- carga de perfiles de ciclo
- carga de perfiles de cama
- conversion de mortandad a porcentaje

### `src/lib/postcosecha-balanzas.ts`

Dominio principal del modulo de `Balanzas`. Resuelve:

- fuentes por tramo BPMN
- introspeccion de columnas de vistas
- filtros globales
- normalizacion de semana ISO
- armado de nodos, overlays y tablas
- calculo del macro indicador por tramo

### `src/lib/multi-select.ts`

Utilidades para codificar, decodificar y comparar filtros multiseleccion.

### `src/lib/dashboard-seed.ts`

Seed local para `Comparacion` y piezas heredadas de la etapa inicial.

### `src/lib/fonts.ts`

Configuracion tipografica.

### `src/lib/utils.ts`

Utilidades compartidas como `cn()`.

## 9. Proxy

### `src/proxy.ts`

Capa de compatibilidad o redireccion para rutas legacy del proyecto. Se mantiene fuera de `app/` porque responde a la convencion nueva del framework.

## 10. Como decidir donde editar

### Quieres cambiar el menu o nombre del producto

Editar:

- `src/config/dashboard.ts`
- `src/components/app-sidebar.tsx`

### Quieres cambiar el look general

Editar:

- `src/app/globals.css`
- componentes del shell en `src/components/`

### Quieres cambiar la consulta o logica de negocio de Fenograma

Editar:

- `src/lib/fenograma.ts`

### Quieres cambiar filtros o interaccion del modulo Fenograma

Editar:

- `src/components/dashboard/fenograma-explorer.tsx`

### Quieres cambiar la tabla pivoteada

Editar:

- `src/components/dashboard/fenograma-pivot-table.tsx`

### Quieres cambiar el contrato de API

Editar:

- la ruta correspondiente en `src/app/api/`
- y la logica de dominio en `src/lib/`

### Quieres conectar Comparacion a datos reales

Editar:

- `src/app/(dashboard)/dashboard/comparacion/page.tsx`
- `src/lib/dashboard-seed.ts` o reemplazarla por una nueva libreria de dominio real
- posiblemente crear nuevas rutas API si el modulo se vuelve interactivo

### Quieres cambiar el flujo o indicadores de Poscosecha Balanzas

Editar:

- `src/lib/postcosecha-balanzas.ts`
- `src/components/dashboard/balanzas-explorer.tsx`
- `src/components/dashboard/balanzas-process-viewer.tsx`
- `src/components/dashboard/balanzas-grouped-table.tsx`

## 11. Archivos mas sensibles

Estos archivos merecen mas cuidado porque concentran comportamiento de negocio o de shell:

- `src/lib/fenograma.ts`
- `src/lib/db.ts`
- `src/config/dashboard.ts`
- `src/components/app-sidebar.tsx`
- `src/components/dashboard/fenograma-explorer.tsx`
- `src/components/dashboard/fenograma-pivot-table.tsx`
- `src/lib/postcosecha-balanzas.ts`
- `src/components/dashboard/balanzas-explorer.tsx`

Un cambio mal planteado aqui afecta toda la experiencia del dashboard o rompe el modulo principal.
> LEGACY / reference only. Ver `docs/module-contracts.md` para la frontera vigente.
