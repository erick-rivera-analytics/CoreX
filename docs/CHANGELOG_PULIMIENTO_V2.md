> LEGACY / reference only.

# CoreX — Pulimiento V2 aplicado

Cambios incorporados en este paquete:

- Inicio reorganizado por bloques funcionales con anclas internas.
- Sidebar más ancho y con header/footer fijos; el scroll queda en el cuerpo del menú.
- Ajustes tipográficos hacia una lectura más fina usando Manrope y pesos más controlados.
- Controles y superficies unificados: radios, bordes y densidad visual compartida.
- Nuevo `SingleSelectField` para alinear selects simples con los multiselect.
- Fenograma y Productividad migrados al select compartido en filtros críticos.
- Talento Humano conserva multiselect unificado y mejora contraste del heatmap en dark mode.
- Mapa simplificado: se removieron tarjetas secundarias bajo el canvas principal.
- Normalización central de áreas (`A-4` -> `SJP`) movida a `src/shared/lib/area-normalization.ts`.
- Administrar SKU mejoró jerarquía, espaciado y respiración visual del listado/editor.
- Clasificación en blanco mejoró tabla, headers sticky e inputs numéricos.
- Seguridad reforzada: sesión con expiración, firma segura, bypass admin solo opcional en dev y rate limit básico en login.

Archivos nuevos clave:

- `src/shared/filters/single-select-field.tsx`
- `src/shared/lib/area-normalization.ts`
- `src/server/security/rate-limit.ts`
- `docs/CHANGELOG_PULIMIENTO_V2.md`
# LEGACY / reference only

Este changelog es historico. Para reglas vigentes usar `docs/reuse-index.md`, `docs/extender-modulos.md`, `docs/ui-canon.md` y `docs/security-ops.md`.
> LEGACY / reference only. No usar este documento como fuente viva de crecimiento.
