# Module Contracts

## Frontera obligatoria

```text
src/app -> src/modules -> src/shared + src/lib
```

Reglas:
- `src/app` no debe saltarse `src/modules` para meter UI visible de producto
- `src/modules` no debe crear dependencias nuevas hacia `src/components/dashboard`
- imports cruzados entre modulos estan prohibidos salvo:
  - `src/shared/*`
  - `src/lib/*`
  - `src/config/*`
  - `src/hooks/*` compartidos

## Contrato de pagina

Toda pagina dashboard debe:
- vivir en `src/app/(dashboard)/dashboard/**/page.tsx`
- validar acceso con `requirePageAccess` o `loadProtectedPageData`
- mapearse al catalogo si es visible o gestionada
- usar `DashboardRouteError` si el loader puede fallar

## Contrato de modulo nuevo

Todo modulo nuevo debe tener:
- un componente raiz visible del modulo
- subcomponentes internos bajo `src/modules/<modulo>/components`
- loader/server contract si hay datos iniciales
- tests minimos segun impacto
- documentacion de excepciones si rompe el canon UX/UI

`src/components/dashboard` queda congelado para legacy.

## Contrato de API

Toda API protegida debe:
- llamar `requireAuth(request)`
- tener regla explicita en `src/lib/access-control.ts`
- responder errores compatibles `{ message, error }`
- no exponer stack traces en produccion
- usar `requestId` en rutas nuevas o helpers modernizados

## Contrato de datos

- queries compartidas e infraestructura en `src/lib`
- mappers de pantalla en `src/modules/<modulo>`
- UI reusable en `src/shared`
- fetch cliente por `@/lib/fetch-json`
- formatters por `@/shared/lib/format`
- `pct_mortality` debe tratarse como campo calculado en SQL/fuente de datos; los mappers TS solo normalizan o formatean, no redefinen la formula

## Politica de TEMPORARY_SHIM

Si un archivo transicional vive en `src/components/dashboard/*`, debe cumplir todo:
- comentario `TEMPORARY_SHIM` en la primera linea
- fuente de verdad declarada
- fecha objetivo de retiro en comentario o documento asociado
- listado en `docs/quality-baseline.md`

## Limites de crecimiento

- UI nueva: maximo recomendado 350 lineas por componente
- dominio/query nueva: maximo recomendado 700 lineas por archivo
- cualquier excepcion requiere plan de split documentado
