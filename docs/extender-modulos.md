# Extender Modulos

Flujo unico, obligatorio y secuencial para agregar o ampliar una pantalla visible.

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

Regla: si aun no esta listo, usar `status: "hidden"`. No introducir placeholders como si fueran modulos productivos.

### 2. Ruta `page.tsx`

La ruta visible vive en `src/app/(dashboard)/dashboard/**/page.tsx`.

Debe usar exactamente uno de estos caminos:
- `loadProtectedPageData` si hay carga inicial de datos
- `requirePageAccess` si solo necesita validar acceso

Si el loader puede fallar, usar `DashboardRouteError`.

### 3. Loader y orquestacion

Distribucion obligatoria:
- queries e infraestructura: `src/lib`
- orquestacion server y mapping de pantalla: `src/modules/<modulo>`
- UI reusable: `src/shared`

No mezclar queries pesadas dentro del explorer.

### 4. UI del modulo

La UI visible nueva vive en:

```text
src/modules/<modulo>/components
src/modules/<modulo>/hooks
src/modules/<modulo>/server
src/modules/<modulo>/index.ts   # solo si hace falta exponer contrato publico
```

Reglas:
- no crear explorers nuevos en `src/components/dashboard`
- no importar desde `@/components/dashboard/*`
- reutilizar primero `src/shared/*`

### 5. API y seguridad

Si el modulo agrega una API protegida:
- debe llamar `requireAuth(request)`
- debe tener regla explicita en `src/lib/access-control.ts`
- debe responder errores compatibles `{ message, error }`
- si es ruta nueva o modernizada, debe incluir `requestId`

### 6. Tests minimos

Agregar lo que aplique:
- test de catalogo/RBAC si aparece ruta visible nueva
- test de acceso API si aparece API protegida
- test de formatter/parser si nace logica reusable
- smoke visual manual si cambia una pantalla critica

### 7. Validacion obligatoria

Antes de cerrar el lote:
- `npm run check`
- `npm run canon:check`

## Checklist de no romper crecimiento

- no importar desde `@/components/dashboard/*`
- usar `@/lib/fetch-json` como fetcher cliente canonico; no inventar bridges/fetchers alternos
- no crear componentes >350 lineas sin plan de split documentado
- no crear archivos de dominio/query >700 lineas sin plan de split documentado
- no introducir excepciones UX/UI sin documentarlas en `docs/ui-canon.md`
