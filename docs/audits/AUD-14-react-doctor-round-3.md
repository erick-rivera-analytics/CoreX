# AUD 14 — React Doctor Round 3

## 1. Contexto

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-26 |
| Ruta local | `C:\Users\erick.rivera\Desktop\CoreX\corex_v4` |
| Rama | `main` |
| Worktrees | 1 (principal) |
| Commit inicial | `b3fe215` (cierre AUD 13) |
| Commit final | (anota tras commit AUD 14) |
| Origen | Re-corrida `react-doctor` post-AUD-13 en `C:\Users\erick.rivera\AppData\Local\Temp\react-doctor-eaec8799-a3ac-47e6-ab1a-58897d8b166a` |

**Naturaleza:** Round 3 de limpieza no invasiva. Cierra hallazgos accionables que quedaron tras AUD 13.

---

## 2. Comparación AUD 13 → AUD 14

### Cambios de count

| Categoría | AUD 13 | AUD 14 | Delta |
|-----------|--------|--------|-------|
| `knip/files` | 32 | 30 | -2 (shims queries.ts eliminados) |
| `knip/exports` | 80 | 79 | -1 (TALENTO_COLORS alias) |
| `no-array-index-as-key` | 11 | 9 | -2 (programaciones + person-list) |
| `no-tiny-text` | 5 | 5 | sin delta de count, pero el threshold subió: AUD 13 cerró 9px hits; AUD 14 detecta 11px y 10px (rule mín 12px) |

### Cerrados en AUD 14

| Hallazgo | Cantidad | Acción |
|----------|----------|--------|
| `no-tiny-text` inline programaciones (11px y 10px) | 5 | `→ 12px` (mínimo WCAG canon) |
| `no-array-index-as-key` con valor estable | 9 | keys derivadas del item (label, rowY, dy, href) |

---

## 3. Cambios aplicados

### 3.1 Tiny-text inline → 12px (mínimo WCAG)

**Archivo:** `src/modules/programaciones/components/programaciones-explorer.tsx`

5 ocurrencias inline subidas a 12px:

| Línea | Antes | Después | Contexto |
|-------|-------|---------|----------|
| 163 | `fontSize: "11px"` | `"12px"` | Badge fumigación dron |
| 169 | `fontSize: "11px"` | `"12px"` | Badge ilumLabel |
| 183 | `fontSize: "11px"` | `"12px"` | Badge variety |
| 636 | `fontSize: "10px"` | `"12px"` | Badge variety en panel detalle |
| 757 | `fontSize: "10px"` | `"12px"` | Badge variety en agrupación |

**Resultado:** 0 hits font < 12px en programaciones.

### 3.2 Array index keys → keys con valor estable

| Archivo | Línea | Antes | Después |
|---------|-------|-------|---------|
| `balanzas-svg-parts.tsx` | 60 | `key={i}` (lines.map) | `key={line}` (texto único) |
| `balanzas-svg-parts.tsx` | 76 | `key={\`gw-row-${i}\`}` | `key={\`gw-row-${rowY}\`}` (rowY número único) |
| `balanzas-svg-parts.tsx` | 112 | `key={\`destlbl-pre-${i}\`}` | `key={\`destlbl-pre-${rowY}\`}` |
| `balanzas-svg-parts.tsx` | 119 | `key={\`destlbl-ap-${i}\`}` | `key={\`destlbl-ap-${rowY}\`}` |
| `balanzas-svg-parts.tsx` | 157 | `key={\`cl-end-${i}\`}` | `key={\`cl-end-${dy}\`}` |
| `balanzas-process-svg-viewer.tsx` | 208 | `key={i}` (visibleMetrics) | `key={m.label}` |
| `breadcrumb.tsx` | 29 | `key={\`${item.label}-${index}\`}` | `key={item.href ?? item.label}` |
| `action-menu.tsx` | 84 | `key={\`${item.label}-${index}\`}` | `key={item.label}` |
| `app-sidebar.tsx` | 50 | `[5,3,4,2].map((count, i) => key={i})` + nested `key={j}` | Array de objetos `{id, count}` con `key={row.id}` + nested `key={\`${row.id}-row-${j}\`}` |

**Resultado:** 0 hits `array index as key` (de 9 a 0).

---

## 4. Tier 3 — Deuda restante NO bloqueante (sin cambios)

Sin cambios respecto a AUD 12/13. Documentación canon vigente:

| Hallazgo | Count | Estado |
|----------|-------|--------|
| `no-giant-component` | 5 | Deuda AUD 1/2/9 |
| `no-z-index-9999` (Leaflet) | 6 | Excepción canon AUD 2 |
| `click-events-have-key-events` (backdrops) | 5 | Intencional click-to-close |
| `no-static-element-interactions` | 4 | Mismo motivo |
| `prefer-useReducer` | 7 | Refactor opcional |
| `prefer-dynamic-import` (recharts) | 6 | Charts ya lazy donde crítico |
| `no-cascading-set-state` (multi-select) | 1 | Refactor de filter, riesgo |
| `no-effect-event-handler` | 5 | Review case-by-case |
| `no-derived-useState` (5: search-input ×2 FP + theme + 2 forms) | 5 | Patterns válidos: store-prev (FP) + controlled-uncontrolled (forms) |
| `no-inline-exhaustive-style` (programaciones) | 2 | Refactor menor |
| `knip/files` 30 | 30 | API canon o `validate-runtime-env.mjs` Dockerfile |

---

## 5. Archivos modificados

```
edit  src/modules/programaciones/components/programaciones-explorer.tsx       (5 fontSize → 12px)
edit  src/modules/postcosecha/components/balanzas-svg-parts.tsx              (5 keys con valor estable)
edit  src/modules/postcosecha/components/balanzas-process-svg-viewer.tsx     (1 key con m.label)
edit  src/shared/navigation/breadcrumb.tsx                                    (key item.href ?? item.label)
edit  src/shared/ui/action-menu.tsx                                           (key item.label)
edit  src/shared/layout/app-sidebar.tsx                                       (skeleton con id estable)
new   docs/audits/AUD-14-react-doctor-round-3.md                              (este archivo)
edit  scripts/check-canon.mjs                                                 (AUD-14 a officialDocs)
edit  docs/audits/README.md                                                   (fila AUD 14)
```

---

## 6. Validación final

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ⚠️ 9 warnings preexistentes (sin nuevos) |
| `npm run test` | ✅ 16 archivos / 79 tests passing |
| `npm run canon:check` | ✅ Canon + Docs verde |
| `npm run legacy:check` | ✅ passed (6 warnings preexistentes) |
| `npm run build` | ✅ verde |

---

## 7. Riesgos residuales

**0 introducidos por AUD 14.** Cambios mecánicos sin alteración de comportamiento.

Riesgos heredados consolidados en [`AUD-10-pre-release-go-live.md`](./AUD-10-pre-release-go-live.md) §11 siguen vigentes.

---

## 8. Cierre AUD 14

- [x] main confirmado
- [x] cero worktrees
- [x] 5 fontSize 10/11px → 12px
- [x] 9 array index keys → keys con valor estable
- [x] npm run typecheck verde
- [x] npm run test verde (79/79)
- [x] npm run canon:check verde
- [x] npm run build verde
- [x] doc AUD-14 actualizado

**AUD 14 cerrado. Mantiene CIERRE OK PARA PRODUCCIÓN de AUD 11.**
