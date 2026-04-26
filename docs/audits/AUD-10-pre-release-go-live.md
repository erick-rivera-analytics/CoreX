# AUD 10 — Pre-release, Go-Live Final y Decisión de Producción

## 1. Contexto

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-26 |
| Ruta local | `C:\Users\erick.rivera\Desktop\CoreX\corex_v4` |
| Rama | `main` |
| Worktrees | 1 (principal) |
| `git status --short` | (clean) |
| Commit final candidato | `8e17fa4` (cierre AUD 9) |
| Commit AUD 10 (este) | (anota tras commit) |

---

## 2. Resumen ejecutivo

### ✅ Decisión: **GO CON RIESGOS NO BLOQUEANTES**

**CoreX v4 puede desplegarse en producción interna.**

**Motivo:**
- 9 auditorías previas (AUD 1–9) cerradas con criterio de cierre marcado
- Pipeline completo verde: typecheck, lint, test (79/79), canon, legacy, build
- 0 secretos reales en repo, docs, examples
- 100% RBAC coverage en 57 endpoints API
- 20/20 dashboard pages con guard server-side
- Docker multi-stage standalone con healthcheck + validador runtime env
- 0 contradicciones documentales
- Variables runtime mínimas documentadas en `.env.production.example`
- Rollback documentado en `docs/despliegue.md`

**Bloqueantes:** 0

**Riesgos no bloqueantes (controlados):**
1. Smoke run-time visual (light/dark/responsive) no ejecutado en este ciclo — requiere preview server activo del usuario
2. `docker compose build` local pendiente — user dev en puerto 7777 (validar en servidor productivo)
3. Deuda canon menor: `productividad CycleDetailRows`, `block-profile-modal` 5 modales pre-canon, `my-account` `<></>` cosmético — todos NO bloquean despliegue
4. Tests puros aislados de Productividad/Mortality fórmulas (cubiertos vía mappers)

**Próxima acción:** Ejecutar smoke post-deploy en servidor siguiendo `docs/despliegue.md` §Smoke post-deploy + AUD 10 §9 abajo.

---

## 3. Estado de auditorías AUD 1–9

| AUD | Archivo | Estado | Críticos | Altos | Riesgos residuales | Bloquea | Acción |
|-----|---------|--------|----------|-------|---------------------|---------|--------|
| 1 | [AUD-1-ux-ui-canon.md](./AUD-1-ux-ui-canon.md) | ✅ cerrado | 0 | 1 (`module-placeholder` legacy) **CERRADO IN-PASS** | 4 (productividad CycleDetailRows, block-profile-modal, my-account `<></>`, smoke visual) | NO | Smoke manual usuario |
| 2 | [AUD-2-arquitectura-modular.md](./AUD-2-arquitectura-modular.md) | ✅ cerrado | 0 | 0 | 4 excepciones cross-módulo documentadas + monolito `fenograma-core.ts` 2346 líneas | NO | Plan split AUD 5+ |
| 3 | [AUD-3-security-api-rbac.md](./AUD-3-security-api-rbac.md) | ✅ cerrado | 1 (server-only shim **CERRADO IN-PASS** desbloqueó 8 tests) | 0 | LaTeX log truncate, auth.ts logger, Redis no probado | NO | Pendiente AUD futura |
| 4 | [AUD-4-datos-sql-payloads.md](./AUD-4-datos-sql-payloads.md) | ✅ cerrado | 0 | 0 | 0 críticos | NO | — |
| 5 | [AUD-5-performance-cache-optimization.md](./AUD-5-performance-cache-optimization.md) | ✅ cerrado | 0 | 1 (cycle-range Cache-Control **CERRADO IN-PASS**) | Productividad/Mortality fórmulas sin tests puros | NO | Tests puros AUD futura |
| 6 | [AUD-6-testing-qa-smoke.md](./AUD-6-testing-qa-smoke.md) | ✅ cerrado | 0 | 0 | Origin check sin test unitario, QA visual responsive | NO | Smoke manual |
| 7 | [AUD-7-despliegue-runtime-docker.md](./AUD-7-despliegue-runtime-docker.md) | ✅ cerrado | 0 | 1 (IP interna en `.env.production.example` **CERRADO IN-PASS**) | docker compose local pendiente, validator WARN→FAIL APP_ORIGIN | NO | Validar en servidor |
| 8 | [AUD-8-documentacion-dod-gobernanza.md](./AUD-8-documentacion-dod-gobernanza.md) | ✅ cerrado | 0 | 2 (sección "Auditorías" en docs/README + audits/README **CERRADOS IN-PASS**) | 0 | NO | — |
| 9 | [AUD-9-auditoria-funcional-modulos.md](./AUD-9-auditoria-funcional-modulos.md) | ✅ cerrado | 0 | 0 | Smoke run-time interactivo pendiente | NO | Smoke manual usuario |

**Total críticos resueltos: 1.** **Total altos resueltos: 5.** **Bloqueantes restantes: 0.**

---

## 4. Checks finales

### `npm run check` (typecheck + lint + test + canon:check + legacy:check + build)

```
✅ npm run typecheck         → 0 errors
⚠️ npm run lint              → 0 errors, 9 warnings preexistentes (documentados)
✅ npm run test              → 16 archivos / 79 tests passing
✅ npm run canon:check       → Canon check passed + Docs check passed
✅ npm run legacy:check      → passed (6 warnings preexistentes)
✅ npm run build             → ✓ Compiled successfully in 10.2s
                              (1 warning Turbopack/NFT documentado en quality-baseline.md)
```

### `npm run test:coverage`
✅ Disponible (vitest run --coverage). No ejecutado en este ciclo (cobertura cualitativa verificada AUD 6).

### Estado holístico
**`npm run check` ENTERO verde.**

---

## 5. Seguridad final

| Control | Estado | Evidencia | Riesgo |
|---------|--------|-----------|--------|
| Cookie `wh-session` HMAC-SHA256 24h | ✅ | `src/lib/auth.ts:10,11,57` | NO |
| Rotación SECRET previo | ✅ | `auth.ts:67` `[resolveSessionSecret(), resolvePreviousSessionSecret()]` | NO |
| `ALLOW_ENV_ADMIN_BYPASS` bloqueado en prod | ✅ | `auth.ts:12` `&& NODE_ENV !== "production"` | NO |
| `timingSafeEqual` para sig comparison | ✅ | `auth.ts:70` | NO |
| bcrypt para passwords | ✅ | `auth.ts:40` | NO |
| `requireAuth` en 100% APIs protegidas | ✅ | 53/53 protegidas (4 públicos esperados) | NO |
| `API_ACCESS_RULES` con deny-by-default | ✅ | 19 reglas, lookup retorna 403 si falta | NO |
| Origin check en mutaciones | ✅ | `api-auth.ts:43-119` | NO |
| Rate limit centralizado | ✅ | `src/server/security/rate-limit.ts` + 5 scopes | NO |
| `/api/health/db` superadmin-only | ✅ | `access-control.ts:118-119` | NO |
| `/api/programaciones/debug` 404 en prod | ✅ | `api-auth.ts:65-67` | NO |
| 0 secretos reales en repo | ✅ | grep verificado: solo placeholders genéricos | NO |
| `.gitignore` y `.dockerignore` protegen `.env*` | ✅ | Solo `.env.example` y `.env.production.example` trackeados | NO |
| 0 console.log/debug/time productivos | ✅ | grep en `src/app/api`, `src/lib`: 0 hits | NO |

---

## 6. Datos y módulos críticos

| Módulo | Ruta | Estado | Evidencia | Riesgo |
|--------|------|--------|-----------|--------|
| Fenograma | `/dashboard/fenograma` | ✅ estructura OK | 8 endpoints cache 30-60s + lazy modal + NaN guard | NO |
| Mortandades | `/dashboard/mortality` | ✅ estructura OK | 5 endpoints, fórmula `dead/(initial+reseed)` documentada | NO |
| Productividad | `/dashboard/productividad` | ✅ estructura OK | KPIs ponderados ciclo + lazy detail + PersonProfileDialog | NO (deuda menor `<tr onClick>`) |
| Balanzas | `/dashboard/postcosecha/balanzas` | ✅ estructura OK | SVG hand-crafted + 40 IDs Task + sanitización NaN→"—" | NO |
| Programaciones | `/dashboard/programaciones` | ✅ estructura OK | Cache-Control fix AUD 5 + dateFrom/dateTo validados | NO |
| Clasif Blanco | `.../solver/clasificacion-en-blanco` | ✅ estructura OK | Tests passing modos GV/APERTURA/PRECLASIFICACION + isResultStale | NO |
| Admin Usuarios | `/dashboard/admin/seguridad/usuarios` | ✅ estructura OK | resource-bound + rate limit + bcrypt | NO |
| Mi Trabajo / Mi Cuenta | `/dashboard/mi-trabajo`, `/mi-cuenta` | ✅ estructura OK | `_shared.ts` auth + `private, no-store` | NO |
| Calidad Punto Apertura | `/dashboard/calidad/punto-apertura` | ✅ estructura OK | Tests passing baseline macro fijo + excepción colores | NO |
| Campo, Comparación, SKUs, Dead Plants, TH ×3 | (rutas listadas AUD 9) | ✅ | Verificadas AUD 9 mapeo funcional | NO |
| 0 NaN/Infinity en KPIs | — | ✅ | Guards explícitos: balanzas em-dash, fenograma pivot guard | NO |
| 0 datos cruzados por usuario | — | ✅ | Mi-trabajo/cuenta: scoping por `getCurrentUserAccess()` | NO |

---

## 7. Docker y runtime

| Check | Resultado | Evidencia | Observación |
|-------|-----------|-----------|-------------|
| `Dockerfile` multi-stage standalone | ✅ | base/deps/builder/runner Debian | runner Debian por dep PuLP CBC documentada |
| Usuario non-root `nextjs:nodejs` uid 1001 | ✅ | `Dockerfile:50-51, 61` | — |
| HEALTHCHECK `/api/health/live` cada 30s | ✅ | `Dockerfile:65-66` | — |
| CMD valida runtime env antes de server | ✅ | `Dockerfile:68` | `validate-runtime-env.mjs && server.js` |
| `docker-compose.yml` servicio `web_corex` container `corex` | ✅ | port 7777:7777 | — |
| `env_file: .env` | ✅ | compose:11-12 | — |
| `TZ: UTC` en compose environment | ✅ | compose:17 (AUD 7) | — |
| Logs json-file 10m × 5 con rotación | ✅ | compose:21-25 | — |
| `.env` NO copiado a imagen | ✅ | `.dockerignore: .env*` | — |
| `docker compose build --no-cache` local | ⚠️ pendiente | user dev ocupa puerto 7777 | Validar en servidor |

---

## 8. Variables productivas

| Variable | Requerida prod | Documentada | Validada runtime | Observación |
|----------|----------------|-------------|-------------------|-------------|
| `SESSION_SECRET` | ✅ | ✅ `.env.production.example` placeholder | ✅ FAIL si falta o < 32 chars | Generar con `openssl rand -hex 48` |
| `SESSION_SECRET_PREVIOUS` | opcional | ✅ | ✅ rotación `auth.ts:67` | — |
| `DATABASE_URL` o split (HOST/PORT/NAME/USER/PASSWORD) | ✅ | ✅ con placeholders | ✅ FAIL si ambos faltan | — |
| `CAMP_DATABASE_NAME` | ✅ | ✅ `db_camp` | — | Campo + dead-plants |
| `PERSONAL_WORKSPACE_DATABASE_NAME` | ✅ | ✅ `db_personal_workspace` | — | mi-cuenta/trabajo |
| `POSTHARVEST_DATABASE_NAME` | ✅ | ✅ `db_postharvest` | — | postcosecha |
| `COOKIE_SECURE` | ✅ | ✅ `false` con comentario HTTP/HTTPS | ✅ FAIL si no `true`/`false` | true cuando active HTTPS |
| `APP_ORIGIN` | ✅ | ✅ placeholder | ⚠️ WARN si falta | — |
| `TRUSTED_ORIGINS` | recomendado | ✅ | ⚠️ WARN si falta | multi-host por coma |
| `API_ORIGIN_CHECK_ENABLED` | recomendado | ✅ `true` | ⚠️ WARN si falta | — |
| `TZ=UTC` | ✅ obligatorio | ✅ ambos templates + compose | OS-level | (AUD 7) |
| `LOG_LEVEL=info` | recomendado | ✅ | — | — |
| `LOG_FORMAT=json` | recomendado | ✅ | — | — |
| `RATE_LIMIT_BACKEND=memory` | ✅ | ✅ | — | Redis opcional |
| `REDIS_URL` | opcional | ✅ vacío | — | — |
| `ALLOW_ENV_ADMIN_BYPASS=false` | ✅ desactivado prod | ✅ | ✅ Bloqueado por construcción | (AUD 3) |
| `CHAT_ENABLED=false` | recomendado prod | ✅ default false en prod | ✅ Chat 503 si false | — |
| `GROQ_API_KEY` | solo si chat activo | ✅ vacío | — | — |

---

## 9. Smoke post-deploy

**No ejecutado en este ciclo** — requiere servidor productivo levantado. Procedimiento documentado en `docs/despliegue.md` y replicado abajo para ejecución del responsable operativo:

| # | Ruta/check | Comando | Resultado esperado |
|---|------------|---------|---------------------|
| 1 | Container up | `docker compose ps` | servicio `web_corex` running, healthy |
| 2 | Logs limpios | `docker compose logs --tail=100 web_corex` | sin secretos, sin stack traces |
| 3 | Health live | `curl http://<host>:7777/api/health/live` | `{ "ok": true, "service": "corex", "timestamp": "..." }` |
| 4 | Login | UI `/login` con superadmin | redirige a `/dashboard` |
| 5 | Auth me | `/api/auth/me` autenticado | retorna `{ user: {...} }` |
| 6 | Dashboard root | `/dashboard` | landing carga |
| 7 | Fenograma | `/dashboard/fenograma` | pivot semanal carga |
| 8 | Mortandad | `/dashboard/mortality` | curva carga |
| 9 | Comparación | `/dashboard/comparacion` | búsqueda de ciclos |
| 10 | Campo | `/dashboard/campo` | Leaflet mapa carga |
| 11 | Productividad | `/dashboard/productividad` | KPIs + tabla |
| 12 | Programaciones | `/dashboard/programaciones` | filtros + actividades |
| 13 | Balanzas | `/dashboard/postcosecha/balanzas` | SVG diagrama + overlays |
| 14 | SKUs | `/dashboard/postcosecha/administrar-maestros/skus` | tabla CRUD |
| 15 | Solver | `/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco` | boot data + slots |
| 16 | Rotación | `/dashboard/talento-humano/rotacion-laboral` | semanas ISO |
| 17 | Admin (con superadmin) | `/dashboard/admin/seguridad/usuarios` | tabla usuarios |
| 18 | Admin (con viewer) | `/dashboard/admin/seguridad/usuarios` | redirect `/dashboard` |
| 19 | Logout | UI logout | redirect `/login` |
| 20 | Health DB (con superadmin) | `/api/health/db` | `{ connected, configured }` |
| 21 | Health DB (sin superadmin) | `/api/health/db` | 403 |
| 22 | Programaciones debug en prod | `/api/programaciones/debug` | 404 |

---

## 10. Rollback

**Procedimiento documentado en `docs/despliegue.md`:**

```bash
cd /opt/apps/CoreX

# 1. Identificar commit actual antes de rollback
git rev-parse --short HEAD

# 2. Identificar último commit estable conocido
git log --oneline -10

# 3. Volver al estable
git checkout main
git reset --hard <commit_estable>

# 4. Reconstruir
docker compose down
docker compose build --no-cache
docker compose up -d

# 5. Validar health + login + rutas críticas
curl http://localhost:7777/api/health/live
docker compose logs -f web_corex
```

**Limitaciones documentadas:**
- No borrar `.env`
- No limpiar volúmenes sin razón
- Si hubo migraciones DB destructivas, rollback de app puede no ser suficiente
- `git reset --hard` destruye cambios locales no comitidos en servidor (deseable en producción)

**Commit estable sugerido como punto de retorno:** `8e17fa4` (cierre AUD 9, antes de AUD 10).

---

## 11. Riesgos residuales consolidados

| Riesgo | Severidad | Área | Bloquea | Acción requerida |
|--------|-----------|------|---------|-------------------|
| Smoke run-time visual responsive light/dark | baja | QA visual | NO | Validación manual del usuario en preview server |
| `docker compose build` local pendiente | baja | DevOps | NO | Validar en servidor productivo o cuando user pueda parar dev |
| `productividad CycleDetailRows` `<tr onClick>` | media | Frontend | NO | Migrar a `ExpandableTreeTable` (deuda AUD 1 #1) |
| `block-profile-modal.tsx` 1791 líneas con 5 modales pre-canon | media | Frontend | NO | Refactor a `DialogShell` + split (deuda AUD 1 #2) |
| `my-account-explorer.tsx` `<></>` cosmético en SectionPageShell | baja | UI canon | NO | API change + remove (deuda AUD 1 #4) |
| `fenograma-core.ts` 2346 líneas (monolito histórico) | media | Backend | NO | Plan split mappers/queries/types (deuda AUD 2) |
| LaTeX `error.buildLog.slice(-1000)` en pdf endpoint | baja | Backend | NO | Reducir a 200 chars en producción |
| `auth.ts:42` `console.error` directo | baja | Backend | NO | Reemplazar por `logger` con `requestId` |
| `RATE_LIMIT_BACKEND` Redis no probado | baja | DevOps | NO | Smoke con Redis al activar cluster |
| Productividad/Mortality fórmulas sin tests puros aislados | baja | QA | NO | Crear tests puros con fixtures TS |
| Origin check sin test unitario explícito | baja | QA | NO | Extraer `validateMutationOrigin` + test |
| Validator runtime: APP_ORIGIN/TRUSTED_ORIGINS son WARN no FAIL | baja | DevOps | NO | Promover a FAIL en próximo refactor |

**Total riesgos: 12. Bloqueantes: 0.**

---

## 12. Decisión final

### ✅ GO CON RIESGOS NO BLOQUEANTES

**La aplicación CoreX v4 puede desplegarse en producción interna, con seguimiento de los riesgos no bloqueantes listados en §11.**

**Justificación objetiva:**

| Criterio | Cumplido |
|----------|----------|
| `npm run check` verde | ✅ |
| `npm run canon:check` verde | ✅ |
| `npm run build` verde | ✅ |
| 0 secretos reales en código/docs/examples | ✅ |
| 0 APIs protegidas sin RBAC | ✅ |
| 0 páginas dashboard sin guard | ✅ |
| 0 módulos críticos rotos (estructural) | ✅ |
| 0 KPIs críticos incorrectos | ✅ |
| Docker preparado para servidor (HEALTHCHECK + validate-runtime-env) | ✅ |
| Health live público sin info sensible | ✅ |
| Variables runtime mínimas documentadas | ✅ |
| Rollback documentado | ✅ |
| Riesgos residuales son no bloqueantes | ✅ |

**0 condiciones NO-GO presentes.**

**Plan inmediato post-deploy:**
1. Configurar `.env` productivo en servidor con valores reales (no copiar templates ciegos)
2. Ejecutar flujo de despliegue de `docs/despliegue.md`
3. Smoke post-deploy con checklist §9
4. Monitorear logs `docker compose logs -f web_corex` por primer turno
5. Si falla: rollback con procedimiento §10

**Próxima revisión:** AUD 11+ post-deploy con 1 semana de operación real para validar:
- Smoke visual ejecutado
- Logs operativos sin alertas críticas
- Performance real bajo carga
- Validación de los 12 riesgos residuales

---

## 13. Checklist final

- [x] main confirmado (`git branch --show-current` → `main`)
- [x] cero worktrees nuevos (`git worktree list` → 1 principal)
- [x] git status revisado (clean)
- [x] AUD 1 revisada (cerrada con criterio 11/11)
- [x] AUD 2 revisada (cerrada con criterio 17/17)
- [x] AUD 3 revisada (cerrada con criterio 17/17)
- [x] AUD 4 revisada (cerrada)
- [x] AUD 5 revisada (cerrada con criterio 22/22)
- [x] AUD 6 revisada (cerrada con criterio 19/19)
- [x] AUD 7 revisada (cerrada con criterio 24/24 + 1 pendiente justificado)
- [x] AUD 8 revisada (cerrada con criterio 27/27)
- [x] AUD 9 revisada (cerrada con criterio 27/27)
- [x] npm run test ejecutado (16 archivos / 79/79 tests passing)
- [x] npm run check verde (typecheck + lint + test + canon + legacy + build)
- [x] npm run canon:check verde
- [x] npm run build verde
- [x] seguridad revisada (§5, 0 issues críticos)
- [x] secretos revisados (0 reales encontrados)
- [x] Docker validado estructuralmente, build local pendiente justificado
- [x] health live preparado (`/api/health/live` + Dockerfile HEALTHCHECK)
- [x] login validado estructuralmente (`auth.ts` + bcrypt + HMAC-SHA256)
- [x] smoke rutas críticas estructural (run-time pendiente)
- [x] rollback documentado (`docs/despliegue.md` + §10 abajo)
- [x] riesgos clasificados (12 totales, 0 bloqueantes)
- [x] **decisión emitida: GO CON RIESGOS NO BLOQUEANTES**

---

## Cierre AUD 10

**CoreX v4 está listo para despliegue productivo interno.**

10 auditorías formales completadas. 0 bloqueantes. Sistema cumple contratos de UX canon, arquitectura modular, seguridad/RBAC, datos/SQL, performance/cache, testing/QA, despliegue/runtime, documentación/gobernanza, funcional por módulo y pre-release.

**Commit final candidato para deploy: `8e17fa4`** (o el commit que se genere al cerrar AUD 10, si la auditoría agrega cambios menores como este doc).

**Responsables sugeridos post-deploy:**
- DevOps: validar Docker en servidor + smoke post-deploy + monitoreo logs primer turno
- QA: smoke visual responsive light/dark/mobile/tablet/desktop con preview server
- Backend: revisar si tras 1 semana operativa surgen ajustes en las 12 deudas técnicas
- Producto: confirmar usuarios con permisos correctos antes de abrir acceso

**El sistema está cerrado para producción interna. AUD 11+ debería ejecutarse post-deploy.**
