# Module Contracts

## Page contract

Toda pagina dashboard debe:

- vivir en `src/app/(dashboard)/dashboard/**/page.tsx`;
- validar acceso con `requirePageAccess` o `loadProtectedPageData`;
- mapearse al catalogo si es visible o gestionada;
- usar `DashboardRouteError` si el loader puede fallar.

## Module UI contract

Toda UI nueva de modulo vive en:

```text
src/modules/<modulo>/components
```

`src/components/dashboard` queda congelado para legacy.

## API contract

Toda API protegida debe:

- llamar `requireAuth(request)`;
- tener regla explicita en `src/lib/access-control.ts`;
- responder errores compatibles `{ message, error }`;
- no exponer stack traces en produccion;
- usar `requestId` en nuevas rutas o helpers modernizados.

## Data contract

- Queries compartidas e infraestructura en `src/lib`.
- Mappers de pantalla en `src/modules/<modulo>`.
- UI pura y reusable en `src/shared`.
- Fetch cliente por `@/lib/fetch-json`.

## Growth limits

- UI nueva: maximo recomendado 350 lineas por componente.
- Dominio/query nueva: maximo recomendado 700 lineas por archivo.
- Excepciones requieren plan de split documentado.
