# Despliegue y rendimiento

## Flujo de actualizacion

```bash
git pull --ff-only origin main
docker compose build
docker compose up -d
docker logs --tail 50 atlas_web_dashboard
```

## 1. Objetivo operativo

La meta de despliegue es correr la app en modo produccion, idealmente en la misma maquina o en la misma red privada donde vive PostgreSQL.

El objetivo no es solo levantar `Next.js`, sino minimizar latencia y hacer que `Fenograma` siga siendo usable aun con una tabla ancha y consultas reales.

## 2. Que mejora el rendimiento de verdad

`Docker` no acelera por si solo.

Lo que si suele mejorar:

- pasar de `next dev` a `next build` + `next start`
- mover la app cerca de PostgreSQL
- reducir latencia de red
- aplicar cache en endpoints pesados
- limitar semanas visibles por default

## 3. Escenario actual vs ideal

### Escenario actual

- desarrollo local
- `npm run dev`
- base remota
- tabla grande
- render cliente con muchas columnas sticky

Este es el peor escenario de rendimiento.

### Escenario recomendado

- `npm run build`
- `npm run start`
- despliegue en servidor
- app en la misma red o maquina que PostgreSQL
- variables de entorno cargadas en runtime

## 4. Variables de entorno

### Opcion A

```env
DATABASE_URL=postgresql://usuario:clave@host:5432/datalakehouse
DATABASE_SSL=false
```

### Opcion B

```env
DATABASE_HOST=10.0.2.70
DATABASE_PORT=5432
DATABASE_NAME=datalakehouse
DATABASE_USER=db_admin
DATABASE_PASSWORD=replace_me
DATABASE_SSL=false
```

Notas:

- no documentar credenciales reales en el repo
- en servidor conviene cargar variables desde secretos o configuracion de entorno, no hardcodearlas

## 5. Validacion previa al despliegue

Ejecutar siempre:

```bash
npm run lint
npm run typecheck
npm run build
```

Si alguno falla, no desplegar.

Nota:

- este repo incluye `.next/types/**` en `tsconfig.json`
- en un entorno completamente limpio, `typecheck` puede requerir una corrida previa de `npm run build` o `npm run dev`

## 6. Simular produccion localmente

```bash
npm run build
npm run start
```

Esto permite separar problemas de `dev` de problemas reales de produccion.

## 7. Despliegue con Docker

El repo ahora incluye un `Dockerfile` multi-stage real para produccion:

- `node:20-alpine`
- `output: "standalone"` en `next.config.ts`
- `npm ci` en etapa de dependencias
- `npm run build` en etapa de build
- runtime final con usuario no root
- puerto interno `3000`
- secretos inyectados por `env_file` en runtime, no dentro de la imagen

## 7.1. Consideraciones del Dockerfile

- usa una etapa para dependencias
- usa una etapa para build
- usa runtime final liviano con `standalone`
- arranca en modo produccion con `node server.js`
- necesita variables de entorno reales al ejecutar el contenedor

## 7.2. Ejecucion recomendada

```bash
cp .env.production.example .env.production
docker compose build
docker compose up -d
```

## 8. Despliegue con compose

El repo ahora incluye `docker-compose.yml` con:

- servicio `web_dashboard`
- `restart: unless-stopped`
- `env_file: .env.production`
- puerto `3000:3000`
- red `atlas_dashboard_net`

Comandos utiles:

```bash
docker compose logs -f web_dashboard
docker compose restart web_dashboard
docker compose down
```

## 9. Recomendaciones de red

Prioridad ideal:

1. misma maquina que PostgreSQL
2. mismo segmento de red privada
3. misma VPN o red interna
4. evitar rutas largas o NAT innecesario

La mejora por cercania a la base puede ser mucho mayor que cualquier ajuste superficial en frontend.

## 10. Observabilidad minima recomendada

Aunque el proyecto aun no tenga monitoreo formal, conviene revisar:

- tiempo de respuesta de `/api/health/db`
- tiempo de respuesta de `/api/fenograma/pivot`
- cantidad de semanas visibles
- cantidad de filas del pivot
- errores 500 en endpoints

## 11. Troubleshooting operativo

## 11.1. La app levanta pero la base falla

Revisar:

1. `.env.local` o variables de entorno del servidor
2. conectividad al host PostgreSQL
3. puerto `5432`
4. nombre de base correcto
5. permisos del usuario de consulta

Ruta util:

- `/api/health/db`

## 11.2. Fenograma responde lento

Revisar:

1. si se esta probando en `dev`
2. si la app esta lejos de PostgreSQL
3. cuantas semanas devuelve el pivot
4. si `Historia` esta activa
5. si la fuente SQL esta lenta por si misma

## 11.3. El modal de bloque tarda en abrir

Revisar:

- latencia a `slv.camp_dim_cycle_profile_scd2`
- latencia a `gld.vw_camp_kardex_cycle_plants_cur`
- tamano del bloque consultado

## 11.4. El detalle de camas tarda en abrir

Revisar:

- latencia a `slv.camp_dim_bed_profile_scd2`
- latencia a `gld.vw_camp_kardex_bed_plants_cur`
- cantidad de camas por ciclo

## 12. Mejoras de rendimiento recomendadas por prioridad

## Nivel 1

- cache `30` a `60` segundos en `/api/fenograma/pivot`
- ultimas `16` o `24` semanas por default
- filtro por bloque

## Nivel 2

- exportacion a Excel
- selector de rango de semanas
- medicion simple de tiempos por endpoint

## Nivel 3

- virtualizacion de filas en la tabla
- vista materializada o tabla preagregada para el pivot
- cola o job de precalculo si el volumen crece mucho

## 13. Regla practica

Si el modulo va medio lento en desarrollo, eso no significa automaticamente que ira lento en produccion.

La mejora mas fuerte suele venir de combinar:

- `build + start`
- despliegue cerca de PostgreSQL
- filtros razonables por default

Lo que seguira costando aun en produccion es el render de una tabla muy ancha con muchas semanas. Ese costo vive del lado del navegador y no se resuelve solo moviendo la app a Docker.
# Nota 2026-04-16

El despliegue Docker valida variables runtime antes de iniciar `server.js` con `scripts/validate-runtime-env.mjs`. En produccion se requiere `SESSION_SECRET` y una configuracion DB valida via `DATABASE_URL` o variables separadas `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`.

El contenedor expone healthcheck contra `/api/health/live`. Esta ruta es publica y no devuelve datos sensibles. `/api/health/db` se mantiene protegida y solo disponible para `superadmin`.

Variables operativas recomendadas:

- `COOKIE_SECURE=true` cuando exista HTTPS formal.
- `APP_ORIGIN=https://tu-dominio`.
- `TRUSTED_ORIGINS=https://tu-dominio`.
- `API_ORIGIN_CHECK_ENABLED=true`.
- `LOG_LEVEL=info`.
- `LOG_FORMAT=json`.
- `RATE_LIMIT_BACKEND=memory` hasta incorporar Redis.
- `REDIS_URL` reservado para backend futuro.
