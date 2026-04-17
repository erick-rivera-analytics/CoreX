# Despliegue

Guia viva para despliegue manual de CoreX con Docker Compose.

## Stack actual

- Next.js 16
- Docker multi-stage
- `docker-compose.yml`
- servicio `web_corex`
- contenedor `corex`
- puerto expuesto `7777`
- `env_file: .env`

## Flujo canonico de actualizacion

```bash
cd /opt/apps/CoreX

git fetch origin
git checkout main
git pull origin main

docker compose down
docker compose build --no-cache
docker compose up -d

docker compose ps
docker compose logs -f web_corex
```

## Si el servidor tiene cambios locales

Usar esto solo si esos cambios NO deben conservarse:

```bash
cd /opt/apps/CoreX

git restore .
git clean -fd
git pull origin main
```

## Variables runtime minimas

La app valida runtime antes de arrancar `server.js`.

Configurar al menos:

### Base de datos

Opcion A:

```env
DATABASE_URL=postgresql://usuario:clave@host:5432/base
```

Opcion B:

```env
DATABASE_HOST=host
DATABASE_PORT=5432
DATABASE_NAME=base
DATABASE_USER=usuario
DATABASE_PASSWORD=clave
```

### Seguridad y sesion

```env
SESSION_SECRET=replace_with_a_long_random_secret
COOKIE_SECURE=false
APP_ORIGIN=http://tu-host-o-dominio:7777
TRUSTED_ORIGINS=http://tu-host-o-dominio:7777
API_ORIGIN_CHECK_ENABLED=true
TZ=UTC
```

`TZ=UTC` es obligatorio en servidor y contenedor para evitar drift de fechas tipo `YYYY-MM-DD` y errores off-by-one al normalizar fechas de BD.

### Logging y rate limit

```env
LOG_LEVEL=info
LOG_FORMAT=json
RATE_LIMIT_BACKEND=memory
REDIS_URL=
```

## Archivos de entorno

- local del desarrollador: `.env.local`
- servidor Docker actual: `.env`
- plantillas: `.env.example`, `.env.production.example`

Regla:

- no sobrescribir secretos reales con las plantillas
- revisar plantillas cuando haya cambios en auth, origin, cookies, Docker o build
- copiar solo variables nuevas requeridas

## Validacion antes de desplegar

```bash
npm run typecheck
npm run lint
npm run build
```

Si alguno falla, no desplegar.

## Health y observabilidad minima

- `/api/health/live`: publico, usado para healthcheck
- `/api/health/db`: protegido, solo `superadmin`

Comandos utiles:

```bash
docker compose ps
docker compose logs -f web_corex
docker compose restart web_corex
docker compose down
```

## Troubleshooting rapido

### La app levanta pero login falla

Revisar:

- `SESSION_SECRET`
- `APP_ORIGIN`
- `TRUSTED_ORIGINS`
- `COOKIE_SECURE`
- `API_ORIGIN_CHECK_ENABLED`
- logs de `web_corex`

### La base falla

Revisar:

- conectividad al host PostgreSQL
- credenciales DB
- `DATABASE_SSL`
- `DATABASE_SSL_REJECT_UNAUTHORIZED`
- `/api/health/db`

### El contenedor builda pero no arranca bien

Revisar:

- que `.env` exista en servidor
- que `SESSION_SECRET` no este vacio
- que `PORT=7777` y `HOSTNAME=0.0.0.0` se mantengan coherentes

## Regla operativa

El deploy real del servidor hoy se gobierna por este documento, `docker-compose.yml` y el codigo. Si cambian nombres de servicio, puertos o variables runtime, este archivo debe actualizarse en el mismo lote.
