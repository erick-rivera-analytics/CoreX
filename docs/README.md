# CoreX v4 — Documentación

Índice de toda la documentación activa. Archivos históricos en [`docs/legacy/`](./legacy/).

---

## Por dónde empezar

Si eres nuevo en el proyecto, lee en este orden:

1. [`arquitectura.md`](./arquitectura.md) — cómo está estructurado el sistema, capas, data flow
2. [`datos.md`](./datos.md) — schema de base de datos, vistas, reglas de negocio SQL
3. [`extender-modulos.md`](./extender-modulos.md) — cómo agregar un módulo nuevo sin romper nada
4. [`module-contracts.md`](./module-contracts.md) — contratos de capa que nunca se violan

---

## Para agregar un módulo

| Paso | Doc |
|------|-----|
| 1. Registrar en el catálogo | [`extender-modulos.md`](./extender-modulos.md) |
| 2. Entender qué vistas usar | [`datos.md`](./datos.md) + [`modulos.md`](./modulos.md) |
| 3. Qué componentes reutilizar | [`reuse-index.md`](./reuse-index.md) |
| 4. Cómo debe verse | [`ui-canon.md`](./ui-canon.md) |
| 5. Checklist antes de cerrar | [`definition-of-done.md`](./definition-of-done.md) |

---

## Para entender los datos

| Doc | Contenido |
|-----|-----------|
| [`datos.md`](./datos.md) | Vistas `gld.*`, `slv.*`, `mdl.*`, naming canon, reglas de imputación, patrones SQL |
| [`modulos.md`](./modulos.md) | Qué vista usa cada módulo, sus KPIs y archivos clave |

---

## Docs por dominio

Referencia rápida de funcionalidad específica. Leer antes de tocar esos módulos.

| Doc | Módulo |
|-----|--------|
| [`gestion-calidad-punto-apertura.md`](./gestion-calidad-punto-apertura.md) | Calidad — carta de control, KPIs, baseline, filtros, API |
| [`gestion-postcosecha-clasificacion-en-blanco.md`](./gestion-postcosecha-clasificacion-en-blanco.md) | Solver clasificación en blanco — slots, modos, receta, Python bridge |

---

## Para entender las APIs

| Doc | Contenido |
|-----|-----------|
| [`apis.md`](./apis.md) | Referencia completa de los ~35 endpoints: método, policy, params, respuesta |
| [`security-ops.md`](./security-ops.md) | Auth, RBAC, rate limit, políticas de API |

---

## Para producción

| Doc | Contenido |
|-----|-----------|
| [`despliegue.md`](./despliegue.md) | Docker Compose, variables de entorno, troubleshooting |
| [`security-ops.md`](./security-ops.md) | Sesiones, RBAC, CSP, rate limit, logging |
| [`chatbot.md`](./chatbot.md) | Estado del chat IA, Groq API, límites |

---

## Para calidad y tests

| Doc | Contenido |
|-----|-----------|
| [`testing.md`](./testing.md) | Estrategia sin DB real, smoke routes, cobertura mínima |
| [`quality-baseline.md`](./quality-baseline.md) | Deuda técnica activa, archivos grandes vigilados |
| [`definition-of-done.md`](./definition-of-done.md) | Checklist de cierre de cualquier cambio |

---

## Auditorías de producción

Auditorías formales ejecutadas para certificar el sistema antes de producción.
Cada AUD documenta hallazgos, correcciones aplicadas, riesgos residuales y criterio de cierre.

| Doc | Objetivo |
|-----|----------|
| [`audits/README.md`](./audits/README.md) | Índice de las 8 auditorías con estado, fecha y bloqueante |
| [`audits/AUD-1-ux-ui-canon.md`](./audits/AUD-1-ux-ui-canon.md) | UX/UI canon — mapeo 17 rutas, legacy migrado, exceptions |
| [`audits/AUD-2-arquitectura-modular.md`](./audits/AUD-2-arquitectura-modular.md) | Arquitectura modular — frontera de imports, 4 excepciones documentadas |
| [`audits/AUD-3-security-api-rbac.md`](./audits/AUD-3-security-api-rbac.md) | Seguridad/RBAC/APIs — 100% coverage, 8 tests desbloqueados |
| [`audits/AUD-4-datos-sql-payloads.md`](./audits/AUD-4-datos-sql-payloads.md) | Datos/SQL/payloads — vistas, fórmulas KPI, escalas % |
| [`audits/AUD-5-performance-cache-optimization.md`](./audits/AUD-5-performance-cache-optimization.md) | Performance/cache — 41 endpoints Cache-Control, lazy bundles |
| [`audits/AUD-6-testing-qa-smoke.md`](./audits/AUD-6-testing-qa-smoke.md) | Testing/QA/smoke — 79/79 tests, E2E opt-in |
| [`audits/AUD-7-despliegue-runtime-docker.md`](./audits/AUD-7-despliegue-runtime-docker.md) | Despliegue/Docker/runtime — TZ=UTC, IP placeholder |
| [`audits/AUD-8-documentacion-dod-gobernanza.md`](./audits/AUD-8-documentacion-dod-gobernanza.md) | Documentación/DoD/gobernanza — este audit |
| [`audits/AUD-16-pre-prod-readiness-2026-05.md`](./audits/AUD-16-pre-prod-readiness-2026-05.md) | Pre-producción 2026-05 — mv_, RBAC, canon, env (107/107 tests) |

---

## Todos los docs activos

| Archivo | Qué es |
|---------|--------|
| `arquitectura.md` | Stack, capas, frontera inmutable, data flow, RBAC, module catalog |
| `datos.md` | Schema DB: vistas `gld.*`/`slv.*`/`mdl.*`, naming, business rules, patrones SQL |
| `modulos.md` | Catálogo de los módulos visibles: datos, KPIs, archivos, endpoints (17 active + 3 hidden = 20 entradas en `module-catalog.ts`) |
| `apis.md` | Referencia de todos los endpoints REST (~57): policy, params, response |
| `gestion-calidad-punto-apertura.md` | Dashboard de calidad para punto de apertura: baseline macro, filtros, carta de control y drill-down |
| `gestion-postcosecha-balanzas-process-engine.md` | Process engine SVG hand-crafted de Balanzas: NODE_LAYOUT, overlays, contrato binding |
| `gestion-postcosecha-clasificacion-en-blanco.md` | Flujo funcional del solver multimodo de postcosecha: slots, persistencia local, receta y exportacion |
| `extender-modulos.md` | Flujo único para agregar o extender módulos — OBLIGATORIO leer |
| `reuse-index.md` | Matriz de componentes/helpers reutilizables — buscar aquí antes de crear |
| `ui-canon.md` | Reglas visuales no negociables: layout, componentes, colores, excepciones |
| `module-contracts.md` | Contratos de capa: qué puede importar quién, qué nunca |
| `definition-of-done.md` | Checklist de cierre de PR/tarea |
| `security-ops.md` | Auth HMAC-SHA256, RBAC, rate limit, health, logging, env |
| `despliegue.md` | Deploy con Docker Compose, variables, troubleshooting |
| `testing.md` | Estrategia de tests, vitest, smoke manual |
| `quality-baseline.md` | Archivos grandes, deuda técnica, metas de retiro |
| `chatbot.md` | Chat IA con Groq: config, límites, riesgos |

---

## Docs archivados

Planes V3, changelogs, auditorías y specs de dominio están en [`docs/legacy/`](./legacy/).
No aplican para trabajo nuevo salvo referencia histórica explícita.
