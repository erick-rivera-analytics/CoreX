# Definition Of Done

Un cambio esta listo cuando cumple todo esto.

## Gate general

- `npm run check` verde
- `npm run canon:check` verde
- `npm run build` verde
- no introduce secretos en logs, docs ni git
- no crea UI reusable fuera de `src/shared`
- no crea pantalla visible sin `module-catalog`
- no crea API protegida sin regla RBAC
- no agrega formatter local simple
- no crea chart sin `ChartSurface`
- no crea tabla sin `ScrollFadeTable` salvo excepcion documentada
- documenta excepciones nuevas

## Si el cambio agrega o amplía un modulo

- la ruta entra por `src/app/(dashboard)/dashboard/**/page.tsx`
- el modulo vive en `src/modules/<modulo>/*`
- el loader usa `loadProtectedPageData` o `requirePageAccess`
- la UI sigue `docs/ui-canon.md`
- la pieza nueva se evaluo primero contra `docs/reuse-index.md`
- no se creo nada nuevo en `src/components/dashboard/*`
- se actualizaron docs si cambia el contrato de crecimiento

## Para PRs de UI

- verificacion visual de light y dark
- responsive en mobile, tablet y desktop
- empty, loading y error revisados
- tooltips y overlays revisados

## Para PRs de seguridad/API

- errores compatibles `{ message, error }`
- `requestId` en errores nuevos cuando aplique
- origin y rate limit revisados si hay mutaciones
- tests sin DB real

## Para despliegue/documentacion

- `docs/despliegue.md` refleja el flujo real si cambian Docker, puertos o variables runtime
- `README.md`, `AGENTS.md` y `CLAUDE.md` no contradicen a los docs oficiales
- la documentacion nueva no duplica reglas si ya existen en `docs/README.md`
