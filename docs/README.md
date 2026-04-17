# Docs Index

Fuente viva de documentacion para crecimiento, operacion y consistencia de CoreX.

## Empezar aqui

- `docs/reuse-index.md`: que reutilizar antes de inventar componentes, helpers o patrones.
- `docs/extender-modulos.md`: flujo oficial para crear o ampliar modulos sin romper arquitectura ni UX/UI.
- `docs/ui-canon.md`: contrato visual y estructural de explorers, tablas, charts, filtros y excepciones validas.
- `docs/module-contracts.md`: fronteras de capas, contratos de pagina, API y crecimiento.
- `docs/definition-of-done.md`: checklist de cierre tecnico, visual y de seguridad.

## Operacion y seguridad

- `docs/security-ops.md`: auth, RBAC, rate limit, origin checks, logging y health endpoints.
- `docs/despliegue.md`: deploy manual actual, Docker Compose, rebuild, variables runtime y troubleshooting.
- `docs/chatbot.md`: estado operativo real del chat contextual y reglas para habilitarlo por pantalla.
- `docs/testing.md`: estrategia de tests, smoke manual y comandos oficiales.
- `docs/quality-baseline.md`: deuda aceptada, legacy vivo y limites estructurales.

## Regla de uso

Si vas a crear algo nuevo:

1. Revisar `docs/reuse-index.md`.
2. Seguir `docs/extender-modulos.md`.
3. Validar `docs/ui-canon.md`.
4. Cerrar con `docs/definition-of-done.md`.

## Historicos

Los demas `.md` dentro de `docs/` son referencia historica o especifica de modulo. No gobiernan crecimiento nuevo salvo que un documento oficial los cite de forma explicita.
