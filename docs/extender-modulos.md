# Extender Modulos

Flujo unico, obligatorio y secuencial para agregar o ampliar pantallas visibles sin romper arquitectura, UX/UI ni gobernanza.

## Regla frontal

Antes de escribir codigo nuevo:

1. revisar `docs/reuse-index.md`
2. validar `docs/ui-canon.md`
3. crear primero en `src/modules/<modulo>`
4. subir a `src/shared/*` solo si la pieza es reusable real

Si algo no existe, no se inventa por reflejo. Primero se decide si debe vivir:

- en `src/shared/*` si aparece en 2 o mas modulos o es primitive transversal
- en `src/modules/<modulo>/*` si es comportamiento irreducible de dominio

## Flujo oficial

### 1. Catalogo primero

Registrar o modificar el modulo en `src/config/module-catalog.ts` antes de crear UI.

Campos obligatorios:

- `key`
- `label`
- `title`
- `eyebrow`
- `summary`
- `href`
- `icon`
- `navigationGroup`
- `trail`
- `accessSection`
- `status`

Regla:

- si aun no esta listo, usar `status: "hidden"`
- no introducir placeholders como si fueran modulos productivos

### 2. Ruta `page.tsx`

La ruta visible vive en `src/app/(dashboard)/dashboard/**/page.tsx`.

Debe usar exactamente uno de estos caminos:

- `loadProtectedPageData` si hay carga inicial de datos
- `requirePageAccess` si solo necesita validar acceso

Si el loader puede fallar, usar `DashboardRouteError`.

### 3. Estructura canonica del modulo

```text
src/modules/<modulo>/
  components/
    <modulo>-page.tsx
    <modulo>-explorer.tsx
    ...
  hooks/
    ...
  server/
    ...
  index.ts            # solo si hace falta exponer contrato publico
```

Distribucion obligatoria:

- queries e infraestructura: `src/lib`
- orquestacion server y mapping de pantalla: `src/modules/<modulo>`
- UI reusable: `src/shared`

No mezclar queries pesadas dentro del explorer.

### 4. UI del modulo

La UI visible nueva vive en `src/modules/<modulo>/components`.

Reglas:

- no crear explorers nuevos en `src/components/dashboard`
- no importar desde `@/components/dashboard/*`
- reutilizar primero `src/shared/*`
- no copiar componentes existentes con otro nombre

## Plantilla minima de explorer

```tsx
<div className="space-y-4">
  <SectionPageShell eyebrow="..." title="..." subtitle="...">
    <FilterPanel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* MultiSelectField / SingleSelectField / DateField / WeekField */}
      </div>

      <KpiGrid>
        <MetricTile label="..." value="..." />
      </KpiGrid>
    </FilterPanel>
  </SectionPageShell>

  {isEmpty ? (
    <EmptyState />
  ) : (
    <>
      <ChartSection>
        <ChartSurface title="...">{/* chart */}</ChartSurface>
      </ChartSection>

      <DetailSection>{/* Card > ScrollFadeTable */}</DetailSection>
    </>
  )}
</div>
```

## Decision tree: si no existe una pieza

### Crear en `src/shared/*`

Solo si:

- el patron ya aparece en 2 o mas modulos
- la API no se contamina con props de dominio
- no rompe el canon visual actual

Ejemplos:

- nuevo filtro generico
- nuevo estado vacio/loading reutilizable
- nuevo wrapper de tabla o chart

### Crear en `src/modules/<modulo>/*`

Si:

- la pieza depende de tipos o interacciones de un modulo
- el layout es de dominio y no aporta a otros modulos
- subirla a shared meteria deuda o props raras

Ejemplos:

- process viewer BPMN de Balanzas
- mapa Leaflet de Campo
- panel medico de Fenograma

## API y seguridad

Si el modulo agrega una API protegida:

- debe llamar `requireAuth(request)`
- debe tener regla explicita en `src/lib/access-control.ts`
- debe responder errores compatibles `{ message, error }`
- si es ruta nueva o modernizada, debe incluir `requestId`

## Tests minimos

Agregar lo que aplique:

- test de catalogo/RBAC si aparece ruta visible nueva
- test de acceso API si aparece API protegida
- test de formatter/parser si nace logica reusable
- smoke visual manual si cambia una pantalla critica

## Checklist de no romper crecimiento

- no importar desde `@/components/dashboard/*`
- usar `@/lib/fetch-json` como fetcher cliente canonico
- no crear componentes >350 lineas sin plan de split documentado
- no crear archivos de dominio/query >700 lineas sin plan de split documentado
- no introducir excepciones UX/UI sin documentarlas en `docs/ui-canon.md`
- no agregar formatters locales simples
- no crear filtros, KPIs o tablas bespoke si el shared ya cubre el caso

## Validacion obligatoria

Antes de cerrar el lote:

```bash
npm run check
npm run canon:check
```

Si el modulo cambia UI visible, ademas validar light, dark, mobile, tablet y desktop.
