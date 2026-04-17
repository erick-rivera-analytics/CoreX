# Chatbot Contextual

Estado operativo real del chat contextual de CoreX.

## Estado actual

El chat:

- no esta montado globalmente en el shell del dashboard
- no forma parte del canon obligatorio de modulos
- vive hoy como capacidad de API contextual, no como UI transversal
- usa `POST /api/chat`
- requiere `GROQ_API_KEY`
- puede deshabilitarse con `CHAT_ENABLED=false`

## Superficie viva

- `src/app/api/chat/route.ts`
- validaciones y limites definidos por variables `CHAT_*`

No existe hoy un modal global activo y estable que deba reutilizarse por defecto en pantallas nuevas.

## Regla para pantallas nuevas

Si un modulo quiere usar chat contextual:

1. debe justificar por que esa pantalla necesita asistencia conversacional
2. debe pasar contexto explicito, nunca datos implicitos del shell
3. debe respetar permisos y visibilidad del modulo actual
4. no debe presentarse como feature global del producto mientras no exista rollout formal

## Contrato operativo

- validar sesion y acceso antes de invocar al proveedor externo
- no loguear prompts completos, secretos ni respuestas sensibles
- responder errores compatibles `{ message, error }`
- mantener limites de mensajes, caracteres y contexto

## Variables de entorno

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
CHAT_ENABLED=true
CHAT_RATE_LIMIT=10
CHAT_RATE_LIMIT_WINDOW_MS=60000
CHAT_MAX_MESSAGES=12
CHAT_MAX_MESSAGE_CHARS=1200
CHAT_MAX_CONTEXT_BYTES=8000
```

## Riesgos pendientes

- rate limit aun en memoria
- sin trazabilidad persistente de conversaciones
- habilitacion por pantalla aun manual
- sin rollout formal de produccion ni observabilidad completa
