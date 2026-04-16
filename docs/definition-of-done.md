# Definition Of Done

Un cambio esta listo cuando cumple:

- `npm run check` verde.
- `npm run canon:check` verde.
- `npm run build` verde.
- No introduce secretos en logs, docs ni git.
- No crea UI reusable fuera de `src/shared`.
- No crea pantalla visible sin `module-catalog`.
- No crea API protegida sin regla RBAC.
- No agrega formatter local simple.
- No crea chart sin `ChartSurface`.
- No crea tabla sin `ScrollFadeTable` salvo excepcion documentada.
- Documenta excepciones nuevas.

## Para PRs de UI

- Verificacion visual de light/dark.
- Responsive en mobile, tablet y desktop.
- Empty/loading/error revisados.
- Tooltips y overlays revisados.

## Para PRs de seguridad/API

- Errores compatibles `{ message, error }`.
- `requestId` en errores nuevos cuando aplique.
- Origin/rate limit revisados si hay mutaciones.
- Tests sin DB real.
