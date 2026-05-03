# Auditorías de Producción CoreX v4

Auditorías formales ejecutadas para certificar el sistema antes de producción interna.

Cada AUD documenta:
- mapeo real del estado del sistema en su área
- hallazgos por bloque (severidad + archivo + problema + corrección)
- correcciones aplicadas in-pass (cuando son seguras)
- riesgos residuales con motivo técnico (cuando no se cierran)
- criterio de cierre marcado punto por punto

**Trabajo siempre en `main`, sin worktrees ni branches paralelas.**

---

## Índice

| AUD | Archivo | Objetivo | Estado | Fecha cierre | Checks ejecutados | Bloqueante |
|-----|---------|----------|--------|--------------|-------------------|------------|
| 1 | [`AUD-1-ux-ui-canon.md`](./AUD-1-ux-ui-canon.md) | UX/UI canon, mapeo 17 rutas, migración legacy `module-placeholder` fuera de `src/components/dashboard/` | ✅ cerrado | 2026-04-25 | typecheck, lint, canon, legacy, build | NO |
| 2 | [`AUD-2-arquitectura-modular.md`](./AUD-2-arquitectura-modular.md) | Frontera de imports `app→modules→shared+lib`, 4 excepciones cross-módulo documentadas | ✅ cerrado | 2026-04-25 | typecheck, canon, legacy | NO |
| 3 | [`AUD-3-security-api-rbac.md`](./AUD-3-security-api-rbac.md) | Seguridad/RBAC/APIs — 57 endpoints, 100% coverage, 8 tests de seguridad desbloqueados | ✅ cerrado | 2026-04-25 | typecheck, canon, lint, test (79/79), build | NO |
| 4 | [`AUD-4-datos-sql-payloads.md`](./AUD-4-datos-sql-payloads.md) | Datos/SQL/payloads — vistas Gold/Silver/Model, fórmulas KPI, escalas %, fechas | ✅ cerrado | 2026-04-25 | typecheck, canon, lint, test, build | NO |
| 5 | [`AUD-5-performance-cache-optimization.md`](./AUD-5-performance-cache-optimization.md) | Performance/cache — 41 endpoints `Cache-Control`, lazy bundles, monolitos vigilados | ✅ cerrado | 2026-04-25 | typecheck, canon, test (79/79), build | NO |
| 6 | [`AUD-6-testing-qa-smoke.md`](./AUD-6-testing-qa-smoke.md) | Testing/QA/smoke — 16 archivos test, 79/79 passing, E2E opt-in | ✅ cerrado | 2026-04-26 | check holístico (typecheck+lint+test+canon+legacy+build) | NO |
| 7 | [`AUD-7-despliegue-runtime-docker.md`](./AUD-7-despliegue-runtime-docker.md) | Despliegue/Docker/runtime — TZ=UTC en compose+envs, IP interna removida de template | ✅ cerrado | 2026-04-26 | typecheck, canon | NO |
| 8 | [`AUD-8-documentacion-dod-gobernanza.md`](./AUD-8-documentacion-dod-gobernanza.md) | Documentación/DoD/gobernanza — índice docs alineado con repo real, riesgos consolidados | ✅ cerrado | 2026-04-26 | typecheck, canon | NO |
| 9 | [`AUD-9-auditoria-funcional-modulos.md`](./AUD-9-auditoria-funcional-modulos.md) | Auditoría funcional por módulo — 17 active + 3 hidden mapeados, contratos verificados | ✅ cerrado | 2026-04-26 | typecheck, canon, test 79/79 | NO |
| 10 | [`AUD-10-pre-release-go-live.md`](./AUD-10-pre-release-go-live.md) | Decisión final de producción — **GO CON RIESGOS NO BLOQUEANTES** | ✅ cerrado | 2026-04-26 | check holístico verde + 12 riesgos clasificados | **GO** |
| 11 | [`AUD-11-cierre-tecnico-final.md`](./AUD-11-cierre-tecnico-final.md) | Cierre técnico final — limpieza de huérfanos, **CIERRE OK PARA PRODUCCIÓN** | ✅ cerrado | 2026-04-26 | check holístico verde + 0 bloqueantes | **OK** |
| 12 | [`AUD-12-react-doctor-knip-cleanup.md`](./AUD-12-react-doctor-knip-cleanup.md) | React Doctor + Knip cleanup — 1 ERROR cerrado + 9 categorías de warnings + 7 archivos huérfanos eliminados | ✅ cerrado | 2026-04-26 | check holístico verde, 79/79 tests | NO |
| 13 | [`AUD-13-react-doctor-round-2.md`](./AUD-13-react-doctor-round-2.md) | React Doctor Round 2 — 3 tiny-text + 2 array keys + 2 shims eliminados + 2 falsos positivos documentados | ✅ cerrado | 2026-04-26 | check holístico verde, 79/79 tests | NO |
| 14 | [`AUD-14-react-doctor-round-3.md`](./AUD-14-react-doctor-round-3.md) | React Doctor Round 3 — 5 tiny-text → 12px (mín WCAG) + 9 array index keys con valor estable | ✅ cerrado | 2026-04-26 | check holístico verde, 79/79 tests | NO |
| 15 | [`AUD-15-react-doctor-round-4.md`](./AUD-15-react-doctor-round-4.md) | React Doctor Round 4 — 5 useEffect-toast → SWR onError + 3 imports useEffect unused | ✅ cerrado | 2026-04-26 | check holístico verde, 79/79 tests | NO |
| 16 | [`AUD-16-pre-prod-readiness-2026-05.md`](./AUD-16-pre-prod-readiness-2026-05.md) | Pre-producción readiness — 100% mv_, 84/84 RBAC, 38/38 pages, canon limpio, 6 env vars críticas pendientes | ✅ cerrado | 2026-05-02 | check holístico verde, 107/107 tests | NO* |

---

## Estado consolidado

| Área | Resultado |
|------|-----------|
| `npm run check` (typecheck+lint+test+canon+legacy+build) | ✅ verde holístico |
| Tests | 16 archivos / 79 tests passing |
| RBAC coverage | 100% (53 protected + 4 públicos esperados) |
| Cache-Control | 41 endpoints declarados, 0 cache pública |
| Secretos en repo | 0 reales (placeholders en `.env.*example`) |
| Frontera de imports | clean con 4 excepciones documentadas en `ui-canon.md` |
| Legacy `src/components/dashboard/` | eliminado (AUD 1) |
| Monolitos vigilados | sin nuevo crecimiento; deuda en `quality-baseline.md` |
| Docker | multi-stage standalone, healthcheck `/api/health/live`, TZ=UTC |
| Validador runtime env | falla early si falta SESSION_SECRET, DB, COOKIE_SECURE |

---

## Riesgos residuales (consolidados de AUD 1–7)

Ningún riesgo bloqueante para producción interna. Pendientes documentados:

| AUD | Riesgo | Severidad | Bloqueante |
|-----|--------|-----------|------------|
| 1 | `productividad-explorer.tsx` `<tr onClick>` ad hoc (deuda canon) | media | NO |
| 1 | `block-profile-modal.tsx` 5 modales pre-canon (1791 líneas) | media | NO |
| 1 | `my-account-explorer.tsx` `<></>` cosmético en SectionPageShell | baja | NO |
| 2 | `fenograma-core.ts` 2346 líneas (monolito histórico) | media | NO |
| 2 | `talento-humano/queries.ts`, `users/queries.ts` mover a `<modulo>/server/queries.ts` | baja | NO |
| 3 | LaTeX `error.buildLog.slice(-1000)` en `pdf/clasificacion/route.ts` | baja | NO |
| 3 | `auth.ts:42` `console.error` podría usar logger estructurado | baja | NO |
| 5 | Redis backend no probado en este ciclo (memory funciona) | baja | NO |
| 7 | `docker compose build` local pendiente (user dev en puerto 7777) | baja | NO |

---

## Cómo ejecutar una AUD nueva

1. Trabajar en `main`, sin worktrees.
2. Verificar git state: `pwd / git branch --show-current / git status / git worktree list`.
3. Leer documentos canon del área a auditar.
4. Mapear estado real (greps, file listing, tests).
5. Detectar hallazgos con severidad + archivo + evidencia.
6. Aplicar correcciones in-pass cuando sean seguras.
7. Documentar riesgos residuales con archivo + motivo + acción.
8. Ejecutar pipeline (typecheck + canon + tests + build).
9. Crear `docs/audits/AUD-N-<area>.md` con estructura canónica.
10. Agregar AUD al `officialDocs` whitelist en `scripts/check-canon.mjs`.
11. Actualizar este índice (`docs/audits/README.md`).
12. Commit + push a `main`.
