# CoreX

Dashboard interno en `Next.js 16` para operacion agricola, postcosecha, talento humano y administracion.

## Estado real

El sistema ya no es una plantilla. Hoy tiene:

- autenticacion real con cookie `wh-session`
- RBAC por recurso para paginas y APIs
- conexion real a PostgreSQL
- navegacion y home derivadas desde un catalogo central de modulos
- dashboards operativos en campo, postcosecha, talento humano y seguridad

### Modulos activos

- `/dashboard/campo`
- `/dashboard/fenograma`
- `/dashboard/mortality`
- `/dashboard/comparacion`
- `/dashboard/productividad`
- `/dashboard/programaciones`
- `/dashboard/postcosecha/balanzas`
- `/dashboard/postcosecha/administrar-maestros/skus`
- `/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco`
- `/dashboard/talento-humano/composicion-laboral`
- `/dashboard/talento-humano/demografia-personal`
- `/dashboard/talento-humano/rotacion-laboral`
- `/dashboard/admin/seguridad/usuarios`

### Rutas ocultas

Existen rutas reservadas que siguen en el arbol del proyecto, pero ya no aparecen en navegacion ni home hasta estar listas:

- `/dashboard/postcosecha/registros`
- `/dashboard/postcosecha/planificacion/programaciones`
- `/dashboard/postcosecha/planificacion/plan-de-trabajo`

## Comandos

```bash
npm install
npm run dev
npm run build
npm run start
npm run check
npm run canon:check
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run e2e:smoke
```

El servidor de desarrollo usa `next dev --webpack`.

## Variables de entorno

La base soporta dos modos:

### Opcion A

```env
DATABASE_URL=postgresql://usuario:clave@host:5432/base
```

### Opcion B

```env
DATABASE_HOST=host
DATABASE_PORT=5432
DATABASE_NAME=base
DATABASE_USER=usuario
DATABASE_PASSWORD=clave
```

Variables importantes adicionales:

- `SESSION_SECRET` obligatorio en produccion
- `SESSION_SECRET_PREVIOUS` para rotacion temporal de sesiones
- `COOKIE_SECURE`
- `APP_ORIGIN`
- `TRUSTED_ORIGINS`
- `API_ORIGIN_CHECK_ENABLED`
- `LOG_LEVEL`
- `LOG_FORMAT`
- `GROQ_API_KEY` para el chatbot contextual
- `CHAT_ENABLED`
- `DATABASE_POOL_MAX`
- `DATABASE_IDLE_TIMEOUT_MS`
- `SLOW_QUERY_THRESHOLD_MS`
- `COMMERCIAL_DATABASE_NAME=db_commercial`
- `COMMERCIAL_CLAIMS_NAS_ROOT` para fotos de `Comercial / Reclamos`

## Postcosecha - KPI Productividad

Esta etapa ya tiene base SQL preparada para construir `Analitica / Postcosecha / Indicadores & KPI / Productividad` con grano por `fecha_post`.

Materializadas nuevas de esta fase:

- `gld.mv_prod_postharvest_capacity_hours_cur`
- `gld.mv_prod_postharvest_step_flow_cur`
- `gld.mv_prod_postharvest_day_universe_cur`
- `gld.mv_prod_postharvest_lot_final_output_cur`
- `gld.mv_prod_postharvest_period_universe_cur`
- `gld.mv_prod_postharvest_rule_hours_cur`
- `gld.mv_prod_postharvest_rule_side_hours_cur`
- `gld.mv_prod_postharvest_hours_box_detail_cur`

Archivo fuente:

- [sql/datalakehouse_postharvest_productivity.sql](C:/Users/paul.loja/AppData/Local/Temp/CoreX_bodega_validate/sql/datalakehouse_postharvest_productivity.sql)

Documentacion tecnica:

- [docs/postcosecha-productividad-arquitectura.md](C:/Users/paul.loja/AppData/Local/Temp/CoreX_bodega_validate/docs/postcosecha-productividad-arquitectura.md)

Aplicacion contra `datalakehouse`:

```bash
node scripts/apply-postharvest-productivity-sql.mjs
```

Fuente formal de reglas operativas:

- `db_postharvest.public.postharvest_ref_productivity_rule_id_core_scd2`
- `db_postharvest.public.postharvest_dim_productivity_rule_profile_scd2`

Seed actual desde los maestros `CLS/SB/EMP`:

```bash
node scripts/apply-postharvest-sql.mjs
node scripts/seed-postharvest-productivity-rules.mjs
node scripts/apply-postharvest-productivity-sql.mjs
node scripts/sync-postharvest-productivity-rules-to-datalakehouse.mjs
```

Cobertura actual de esta etapa:

- horas base de `CLS`, `SB`, `EMP` desde `slv.prod_fact_hours_cur`
- enriquecimiento de actividad desde `slv.prod_dim_activity_profile_scd2`
- flujo canonico de balanzas `B1`, `B1A`, `B1C`, `B2`, `B2A`, `B3`
- correccion de `B2` por `peel_type`
- inferencia de `variety_canon` y `final_destination` para `B3` desde `sku`
- universos diarios por paso para `CLS`, `SB`, `EMP`
- salida final del lote a `fecha_post` para `B2A` y `B3`
- universo consolidado del periodo por `path_post` y `final_destination`
- maestro formal de reglas de productividad en `db_postharvest`
- espejo analitico de reglas en `datalakehouse.gld.prod_dim_postharvest_productivity_rule_cur`
- horas agregadas por `dia + actividad + regla` listas para el reparto final
- reparto preliminar de horas `upstream/downstream` por regla antes del `hours_box_detail`
- detalle granular `hours_box_detail` con `SPECIFIC`, `SPECIFIC_PERIOD`, `FALLBACK_MACRO` y `FALLBACK_DAY`

Nota operativa de esta capa:

- `SPECIFIC` ya aterriza a `fecha_post` real por lote
- `SPECIFIC_PERIOD` y `FALLBACK_MACRO` quedan compactadas con `post_date = work_date` como placeholder, igual que en el motor Python
- la redistribucion de esas filas a `fecha_post` real queda reservada para `gld.mv_prod_postharvest_hours_box_cur`

Pendiente antes del visualizador CoreX:

- construir `gld.mv_prod_postharvest_hours_box_cur`
- cerrar la metodologia de reparto numerico de `hours_per_box`
- definir en UI si `fecha_post`, `path_post`, `final_destination` y `variety_canon` viven primero como filtros, columnas base o ambas

## Comercial - Fotos de reclamos

El modulo `Gestion / Comercial / Reclamos` guarda fotos por API y este flujo debe quedar desacoplado del usuario final.

Ruta NAS actual:

- `\\10.0.2.15\06_transformacion\Vigentes\PROYECTOS\PLANIFICACION\lakehouse\data\nosql\comercial\img`

Estado actual en desarrollo local:

- cuando CoreX corre en `localhost`, la API escribe y lee con la cuenta Windows del usuario que levanta `Next.js`
- esto sirve para desarrollo y pruebas locales, pero no es el modelo correcto para servidor

Requisito obligatorio al pasar a servidor:

1. publicar CoreX en un servidor central
2. ejecutar el proceso `Next.js` / `node` con una cuenta de servicio de dominio
3. dar permisos `Read`, `Write` y `Modify` sobre `COMMERCIAL_CLAIMS_NAS_ROOT` solo a esa cuenta de servicio
4. no dar permisos directos del NAS a los usuarios funcionales del modulo
5. mantener la visualizacion de fotos solo por API:
   - `POST /api/comercial/reclamos/[claimId]/photo`
   - `GET /api/comercial/reclamos/[claimId]/attachments/[attachmentId]`

Regla de consistencia para produccion:

- cargadores, aprobadores y aplicadores no deben depender de permisos directos al share
- el aprobador debe poder ver la foto desde CoreX aunque no tenga acceso a la carpeta NAS
- la cuenta que necesita permiso real sobre la ruta es la cuenta tecnica del backend

Referencia operativa:

- ver `docs/despliegue.md` para el checklist de servidor
- cuenta sugerida para despliegue: `GRUPO-MALIMA\\svc_corex`

Si esta implementacion no se respeta al mover el modulo a servidor, la carga y visualizacion de fotos volvera a depender del usuario Windows que ejecute la app, y eso no es aceptable para operacion estable.

## Arquitectura corta

La frontera actual del proyecto es:

```text
src/app -> src/modules -> src/shared + src/lib
```

Piezas importantes:

- `src/config/module-catalog.ts`: fuente de verdad de modulos, visibilidad y metadatos
- `src/config/sidebar-data.ts`: sidebar derivado desde el catalogo
- `src/config/dashboard.ts`: contexto de pagina, home y mobile nav derivados desde el catalogo
- `src/lib/access-control.ts`: recursos RBAC y reglas API explicitas
- `src/lib/api-auth.ts`: `requirePageAccess()` y `requireAuth()`
- `src/modules/core/server-page.tsx`: helper comun para loaders server-side

Estado estructural actual:

- la UI visible vive en `src/modules/*`
- `src/components/dashboard/*` queda congelado y reducido a `module-placeholder.tsx`
- `src/lib/fenograma.ts` y `src/lib/postcosecha-balanzas.ts` son fachadas temporales; la logica pesada vive en `*-core.ts` y debe seguir partiendose por dominio
- el solver de clasificacion en blanco y Talento Humano ya estan divididos en piezas de modulo pequenas

## Seguridad operativa

- Las paginas `/dashboard/*` requieren sesion valida.
- Las APIs con `requireAuth()` usan reglas explicitas y `deny by default`.
- Las mutaciones pueden validar `Origin`/`Referer` con `API_ORIGIN_CHECK_ENABLED=true`.
- `/api/health/db` es solo `superadmin`.
- `/api/health/live` es publico y no expone datos sensibles.
- `/api/programaciones/debug` es interno y no se expone en produccion.
- Los errores API se normalizan a `{ message, error }`; rutas modernizadas incluyen `requestId`.

## Referencias

- `docs/README.md`: indice vivo de documentacion oficial
- Regla corta: si vas a crear algo nuevo, primero demuestra por que no sirve lo existente en `docs/reuse-index.md`.
- `src/components/dashboard/*` es legacy congelado; crecimiento nuevo va en `src/modules/*`.
- Para crear o extender modulos usa `docs/extender-modulos.md`; no inventes shell, fetchers, filtros, KPIs, tablas ni formatters si existen en `docs/reuse-index.md`.
- `docs/reuse-index.md`: indice obligatorio antes de crear componentes o helpers
- `docs/extender-modulos.md`: flujo canonico para agregar pantallas y APIs
- `docs/ui-canon.md`: reglas visuales y excepciones UX/UI
- `docs/security-ops.md`: auth, RBAC, health, origin checks, rate limit y logging
- `docs/despliegue.md`: deploy manual actual, Docker Compose y runtime env
- `docs/testing.md`: tests obligatorios y smoke manual
- `docs/definition-of-done.md`: criterios de cierre
- `CLAUDE.md`: guia operativa resumida
- `AGENTS.md`: guia para agentes/coding assistants
- `docs/arquitectura.md`: referencia historica de arquitectura actual
- `docs/chatbot.md`: estado real del chatbot contextual
