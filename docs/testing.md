# Testing

## Comandos

```bash
npm run test
npm run test:watch
npm run test:coverage
npm run check
npm run e2e:smoke
```

## Regla

`npm run check` debe correr sin DB real ni secretos.

## Cobertura minima

- Formatters compartidos.
- Rate limit y clave de cliente.
- Session secret y rotacion de token.
- RBAC deny by default y prefijos boundary-aware.
- Catalogo de modulos activos/ocultos.
- Cobertura estatica de APIs protegidas.

## Smoke manual

Rutas criticas:

- `/login`
- `/dashboard`
- `/dashboard/fenograma`
- `/dashboard/mortality`
- `/dashboard/comparacion`
- `/dashboard/campo`
- `/dashboard/productividad`
- `/dashboard/programaciones`
- `/dashboard/postcosecha/balanzas`
- `/dashboard/postcosecha/administrar-maestros/skus`
- `/dashboard/talento-humano/rotacion-laboral`
- `/dashboard/admin/seguridad/usuarios`

Validar light, dark, mobile, tablet y desktop cuando cambie UI.
