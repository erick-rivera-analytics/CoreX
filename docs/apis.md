> Referencia vigente. Mantener sincronizado con `src/lib/access-control.ts`.

# APIs — Referencia de Endpoints

Referencia completa de todos los endpoints REST de CoreX v4. Reemplaza el archivo homónimo archivado en `legacy/`.

**Auth global:** Todos los endpoints (salvo los marcados como públicos) requieren cookie `wh-session` válida.  
**Error estándar:** `{ message: string; error?: string; requestId?: string }`  
**Cache:** Encabezado `Cache-Control` indicado por endpoint. Todos usan `force-dynamic` de Next.js.  
**Políticas:** Las reglas viven en `src/lib/access-control.ts → API_ACCESS_RULES`.

---

## Auth

### `POST /api/auth/login`
**Auth:** Público  
**Body:** `{ username: string; password: string }`  
**Response:** `{ ok: true }`  
**Códigos:** 200, 400 (formato inválido), 401 (credenciales incorrectas), 429 (rate limit)  
**Rate limit:** 80 intentos/60s por IP; 8 intentos/60s por usuario  
**Efecto:** Setea cookie `wh-session` firmada (HMAC-SHA256, TTL 24h)

### `POST /api/auth/logout`
**Auth:** Público  
**Response:** `{ ok: true }`  
**Efecto:** Borra la cookie `wh-session`

### `GET /api/auth/me`
**Auth:** Público (retorna 401 si no hay sesión)  
**Response:**
```json
{
  "ok": true,
  "userId": "string",
  "username": "string",
  "roleCode": "superadmin | viewer | custom",
  "isSuperadmin": true,
  "allowedResources": ["/dashboard/campo", "..."],
  "permissionOverrides": [{ "resourceKey": "string", "canView": true }],
  "authenticatedAt": "2026-01-01T00:00:00Z"
}
```
**Códigos:** 200 (autenticado), 401 (sin sesión)

---

## Health

### `GET /api/health/live`
**Auth:** Público  
**Response:** `{ ok: true; service: "corex"; timestamp: string }`  
**Uso:** Readiness probe de infraestructura. Sin datos sensibles.

### `GET /api/health/db`
**Auth:** `superadmin-only`  
**Response:** `{ connected: boolean; configured: boolean }`  
**Códigos:** 200 (conectado), 503 (configurado pero no conectado)

---

## Admin — Usuarios

**Policy:** `resource-bound` → requiere `/dashboard/admin/seguridad/usuarios`

### `GET /api/admin/users`
**Response:** `{ users: User[] }`

### `POST /api/admin/users`
**Body:**
```json
{
  "username": "string (≥3)",
  "password": "string (≥6)",
  "isActive": true,
  "roleCode": "superadmin | viewer | custom",
  "permissionOverrides": [{ "resourceKey": "/dashboard/campo", "canView": true }]
}
```
**Response:** `{ user: User }` — status 201  
**Códigos:** 201, 400, 409 (username duplicado), 429 (rate limit)  
**Rate limit:** 10 intentos/60s

### `GET /api/admin/users/[userId]`
**Response:** `{ user: User }`  
**Códigos:** 200, 400 (ID inválido), 404

### `PATCH /api/admin/users/[userId]`
**Body:** Todos los campos opcionales — misma forma que POST  
**Response:** `{ user: User }`  
**Códigos:** 200, 400, 404, 409

### `DELETE /api/admin/users/[userId]`
**Response:** `{ ok: true }`  
**Códigos:** 200, 400, 404

---

## Chat

**Policy:** `resource-bound` → requiere cualquier módulo activo no-administrativo  
**Requiere:** `GROQ_API_KEY` en entorno, `CHAT_ENABLED=true`

### `POST /api/chat`
**Body:**
```json
{
  "messages": [{ "role": "user | assistant", "content": "string" }],
  "context": {
    "activeCount": 0,
    "plannedCount": 0,
    "historyCount": 0,
    "areas": [],
    "varieties": [],
    "totalStems": 0,
    "today": "2026-01-01"
  }
}
```
**Límites:** max 12 mensajes, 1200 chars/msg, 8000 bytes de contexto  
**Response:** `{ content: string }`  
**Códigos:** 200, 400, 429 (rate limit), 503 (deshabilitado)  
**Rate limit:** 10 intentos/60s

---

## Programaciones

**Policy:** `resource-bound` → requiere `/dashboard/programaciones`

### `GET /api/programaciones`
**Query params:** `dateFrom` (YYYY-MM-DD, requerido), `dateTo` (YYYY-MM-DD, requerido)  
**Response:** Datos de programación en el rango de fechas  
**Cache:** `private, max-age=60, stale-while-revalidate=300`  
**Códigos:** 200, 400 (fechas faltantes o inválidas)

### `GET /api/programaciones/cycle-range/[cycleKey]`
**Path:** `cycleKey` URL-encoded  
**Response:** `{ min: string | null; max: string | null }` — rango de fechas de ILUMINACION  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/programaciones/debug`
**Policy:** `internal-dev-only`  
**Response:** Diagnóstico de schema de base de datos

---

## Comparación

**Policy:** `resource-bound` → requiere `/dashboard/comparacion`

### `GET /api/comparacion/options`
**Query params:** `q?`, `area?`, `block?`, `variety?`, `limit?`  
**Response:** Lista de opciones de ciclo para comparar  
**Cache:** `private, max-age=30, stale-while-revalidate=120`

### `GET /api/comparacion/pair`
**Query params:** `left` (cycle_key URL-encoded, requerido), `right` (cycle_key URL-encoded, requerido)  
**Response:** Datos de comparación de los dos ciclos (métricas normalizadas)  
**Cache:** `private, max-age=60, stale-while-revalidate=300`  
**Códigos:** 200, 400 (parámetros faltantes)

---

## Fenograma

**Policy:** `resource-bound` → requiere `/dashboard/fenograma`

### `GET /api/fenograma/pivot`
**Query params:** `includeActive?`, `includePlanned?`, `includeHistory?`, `area?`, `variety?`, `spType?`, `startWeek?`, `endWeek?`  
**Response:** Dashboard pivot con tallos semanales por ciclo  
**Cache:** `private, max-age=30, stale-while-revalidate=120`

### `GET /api/fenograma/block/[parentBlock]`
**Path:** `parentBlock` URL-encoded  
**Query params:** `cycleKey?` (URL-encoded)  
**Response:** Ciclos del bloque con plantas, stems, horas, pesos  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/fenograma/cycle/[cycleKey]/beds`
**Response:** Perfiles de camas del ciclo con datos de plantas  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/fenograma/cycle/[cycleKey]/curve`
**Response:** Curva de cosecha (tallos diarios)  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/fenograma/cycle/[cycleKey]/hours`
**Response:** Horas laborales del ciclo por actividad y persona  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/fenograma/cycle/[cycleKey]/hours/person/[personId]`
**Response:** Detalle de horas de una persona en el ciclo  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/fenograma/cycle/[cycleKey]/valves`
**Response:** Lista de válvulas del ciclo con plantas  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/fenograma/cycle/[cycleKey]/valves/[valveId]`
**Response:** Detalle de una válvula (camas, plantas, métricas)  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

---

## Medical

**Policy:** `resource-bound` → requiere `/dashboard/fenograma`, `/dashboard/mortality` o `/dashboard/productividad`

### `GET /api/medical/person/[personId]`
**Response:** Perfil médico de la persona  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

---

## Mortandades

**Policy:** `resource-bound` → requiere `/dashboard/mortality`

### `GET /api/mortality`
**Query params:** `area?`, `spType?`, `variety?`, `parentBlock?`, `block?`  
**Response:** Dashboard de mortandad con resumen por ciclo  
**Cache:** `private, max-age=30, stale-while-revalidate=120`

### `GET /api/mortality/curve`
**Query params:** mismos que `/api/mortality`  
**Response:** Curva de mortandad agregada (todos los ciclos del filtro)  
**Cache:** `private, max-age=30, stale-while-revalidate=120`

### `GET /api/mortality/cycle/[cycleKey]/curve`
**Response:** Curva de mortandad del ciclo (diaria + acumulada)  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/mortality/cycle/[cycleKey]/beds/[bedId]/curve`
**Response:** Curva de mortandad de una cama específica  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

### `GET /api/mortality/cycle/[cycleKey]/valves/[valveId]/curve`
**Response:** Curva de mortandad de una válvula específica  
**Cache:** `private, max-age=60, stale-while-revalidate=300`

---

## Productividad

**Policy:** `resource-bound` → requiere `/dashboard/productividad`

### `GET /api/productividad`
**Query params:** `year?`, `month?`, `spType?`, `variety?`, `area?`, `status?`, `costArea?` (CAMPO | COSECHA | all)  
**Response:** KPIs ponderados agrupados por ciclo y año de cosecha  
**Cache:** `private, max-age=30, stale-while-revalidate=120`

### `GET /api/productividad/[cycleKey]/detail`
**Response:** Desglose de horas laborales del ciclo por actividad  
**Cache:** `private, max-age=30, stale-while-revalidate=120`

---

## Talento Humano

### `GET /api/talento-humano/activos`
**Policy:** `resource-bound` → requiere cualquier módulo `talento-*` excepto rotacion  
**Query params:** `snapshotDate?`, `weekFrom?`, `weekTo?`, `areaGeneral?`, `area?`, `gender?`, `maritalStatus?`, `city?`, `jobTitle?`, `employerName?`, `jobClassification?`, `associatedWorker?`  
**Response:** Composición de personal activo y datos demográficos  
**Cache:** `private, max-age=60, stale-while-revalidate=120`

### `GET /api/talento-humano/rotacion`
**Policy:** `resource-bound` → requiere `/dashboard/talento-humano/rotacion-laboral`  
**Query params:** mismos que activos  
**Response:** Ingresos, salidas y tasa de rotación por semana  
**Cache:** `private, max-age=60, stale-while-revalidate=120`

### `GET /api/talento-humano/persona/[personId]`
**Policy:** `resource-bound` → requiere cualquier módulo `talento-*`  
**Response:** Perfil completo de la persona  
**Cache:** `private, max-age=300, stale-while-revalidate=600`  
**Códigos:** 200, 400 (ID faltante), 404

---

## Postcosecha — Balanzas

**Policy:** `resource-bound` → requiere `/dashboard/postcosecha/balanzas`

### `GET /api/postcosecha/balanzas`
**Query params:** `metric?`, `year?`, `month?`, `dayName?`, `destination?`, `weekMode?`, `weekValue?`, `dateFrom?`, `dateTo?`  
**Response:** Indicadores de balance de peso y tallos entre estaciones  
**Cache:** `private, max-age=30, stale-while-revalidate=120`

---

## Postcosecha — SKUs

**Policy:** `resource-bound` → requiere `/dashboard/postcosecha/administrar-maestros/skus`

### `GET /api/postcosecha/administrar-maestros/skus`
**Response:** Lista de SKUs maestros actuales  
**Cache:** `private, no-store`

### `POST /api/postcosecha/administrar-maestros/skus`
**Body:** `PoscosechaSkuInput`  
**Response:** `{ data: PoscosechaSkuPayload }` — status 201  
**Rate limit:** 20 intentos/60s por IP

### `PATCH /api/postcosecha/administrar-maestros/skus/[skuId]`
**Body:** `PoscosechaSkuInput`  
**Response:** `{ data: PoscosechaSkuPayload }`

---

## Postcosecha — Clasificación en Blanco

**Policy:** `resource-bound` → requiere `/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco`  
**Runtime:** `nodejs` (explícito — requerido por el solver Python)

### `GET /api/postcosecha/planificacion/solver/clasificacion-en-blanco`
**Response:** `PoscosechaClasificacionBootData` — configuración inicial del solver

### `POST /api/postcosecha/planificacion/solver/clasificacion-en-blanco`
**Body:** `PoscosechaClasificacionRunInput`  
**Response:** `{ data: PoscosechaClasificacionRunPayload }` — resultado del solver Python

### `POST /api/postcosecha/planificacion/solver/clasificacion-en-blanco/receta`
**Body:** `PoscosechaClasificacionRecipeInput`  
**Response:** `{ data: PoscosechaClasificacionRecipePayload }` — receta guardada

---

## Dead Plants / Reseed

**Policy:** `resource-bound` → requiere `/dashboard/dead-plants-reseed`
**Escritura adicional:** solo `isSuperadmin` o `roleCode === "custom"` (helper `requireDeadPlantsReseedWrite`).

### `GET /api/dead-plants-reseed`
**Response:** `DeadPlantsReseedInitialData` — bloques activos + últimas cargas por tipo.

### `GET /api/dead-plants-reseed/capture?type&workDate&blockId`
**Response:** `DeadPlantsReseedCaptureRow[]`

### `POST /api/dead-plants-reseed/capture`
**Body:** `CreateCaptureInput`
**Response:** `{ data: CreateCaptureResult }` — status 201
**Rate limit:** `DEAD_PLANTS_RESEED_RATE_LIMIT` (default 20) / `DEAD_PLANTS_RESEED_RATE_LIMIT_WINDOW_MS` (default 60000) por usuario.
**Errores:** 409 `DeadPlantsReseedConflictError` si existe captura previa para el bloque/fecha/tipo.

### `GET /api/dead-plants-reseed/loads?type&dateFrom&dateTo&blockId`
**Response:** `DeadPlantsReseedLoadSummary[]`

### `GET /api/dead-plants-reseed/loads/[runId]?type`
**Response:** `DeadPlantsReseedLoadDetail`

### `PATCH /api/dead-plants-reseed/records`
**Body:** `PatchRecordsInput` — invalida registros anteriores (`is_valid = false`) y crea reemplazos con `change_reason`.
**Response:** `{ data: PatchRecordsResult }`
**Rate limit:** mismo que `POST /capture`.

---

## Notas generales

### Encoding de path params
Todos los parámetros dinámicos (`cycleKey`, `parentBlock`, `valveId`, `bedId`, `personId`, `skuId`) deben ir URL-encoded cuando contienen caracteres especiales. El código los decodifica con `decodeURIComponent`.

### Multi-select de filtros
Los filtros tipo "todos o uno o varios" usan el patrón de `matchesMultiSelectValue`:
- `"all"` = sin filtro
- `"value1,value2"` = múltiples valores
- `"value1"` = valor único

### Registrar una API nueva
Toda ruta protegida nueva debe registrarse en `src/lib/access-control.ts → API_ACCESS_RULES_UNSORTED`:
```ts
{
  pathnamePrefix: "/api/mi-modulo",
  policy: "resource-bound",
  requiredResources: ["/dashboard/mi-modulo"],
},
```
Las reglas se ordenan por longitud descendente automáticamente para que los prefijos más específicos tengan prioridad.
