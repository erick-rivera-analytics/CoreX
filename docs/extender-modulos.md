# Extender Modulos

Flujo unico para agregar o ampliar una pantalla visible.

## 1. Catalogo primero

Agregar o modificar el modulo en `src/config/module-catalog.ts`.

Campos obligatorios: `key`, `label`, `title`, `eyebrow`, `summary`, `href`, `icon`, `navigationGroup`, `trail`, `accessSection`, `status`.

No mostrar placeholders como modulos listos. Si aun no esta funcional, usar `status: "hidden"`.

## 2. Page server

La ruta `src/app/(dashboard)/dashboard/**/page.tsx` debe usar:

- `loadProtectedPageData` si carga datos.
- `requirePageAccess` si no carga datos.
- `DashboardRouteError` para errores de loader.

## 3. Loader

El loader vive en `src/modules/*` o `src/lib/*` segun responsabilidad.

- Queries e infraestructura: `src/lib`.
- Orquestacion de pantalla: `src/modules/<modulo>`.
- UI reutilizable: `src/shared`.

## 4. UI

La UI nueva vive en `src/modules/<modulo>/components`.

No crear explorers nuevos en `src/components/dashboard`.

## 5. APIs

Toda API con `requireAuth(request)` debe tener regla en `src/lib/access-control.ts`.

La respuesta de error conserva `{ message, error }`; para rutas nuevas preferir tambien `requestId`.

## 6. Tests y QA

Agregar pruebas de:

- catalogo/RBAC si aparece nueva ruta visible;
- acceso API si aparece nueva API protegida;
- formatter/parser si aparece logica reusable;
- smoke visual manual si cambia una pantalla critica.

## Checklist rapido

- `npm run canon:check`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
