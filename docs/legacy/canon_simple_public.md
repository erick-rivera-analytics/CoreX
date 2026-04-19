# Canon simple de nombres para bases modulares en PostgreSQL

## 1. Objetivo

Este documento define un canon simple, práctico y escalable para nombrar tablas dentro de bases modulares en PostgreSQL.

La regla deliberada es:

- usar solo el esquema `public`
- mantener todo visible y directo
- resolver la organización mediante el nombre de la tabla
- evitar sobreingeniería temprana
- conservar espacio para crecer sin romper el orden

Este canon aplica especialmente a bases modulares como:

- `db_human_talent`
- `db_payroll`
- `db_social_work`
- otras bases operativas o de formularios

No reemplaza el canon analítico del lakehouse. Aquí la prioridad es simplicidad operativa.

---

## 2. Regla obligatoria de nombres

Toda tabla debe seguir esta estructura:

```text
<domain>_<kind>_<entity>_<role>_<temporal>
```

Ejemplo general:

```text
tthh_fact_absence_request_cur
nomina_fact_employee_novelty_cur
ttss_dim_case_profile_scd2
```

---

## 3. Significado de cada parte

### 3.1 `domain`

Identifica el área o subárea funcional dueña de la tabla.

Ejemplos:

- `tthh` = talento humano general
- `nomina` = nómina
- `ttss` = trabajo social
- `salud` = salud ocupacional
- `capacitacion` = capacitación
- `common` = catálogos y objetos compartidos dentro de la base modular

Regla:

- una tabla pertenece a un solo `domain`
- no mezclar varios prefijos para la misma subárea
- elegir un solo nombre oficial y sostenerlo

Ejemplo correcto:

```text
ttss_fact_case_intake_cur
```

Ejemplo incorrecto:

```text
ttss_fact_case_intake_cur
ssww_fact_case_intake_cur
socialwork_fact_case_intake_cur
```

---

### 3.2 `kind`

Define el tipo estructural de la tabla.

Valores recomendados:

- `ref` = identidad o registro base
- `dim` = entidad descriptiva
- `fact` = evento, transacción o movimiento
- `asgn` = asignación o relación
- `map` = mapeo o homologación
- `log` = bitácora técnica o funcional

Regla:

- usar `fact` para tablas transaccionales de formularios o registros operativos
- usar `dim` para maestros o perfiles
- usar `ref` solo si realmente separas identidad mínima de atributos

---

### 3.3 `entity`

Es el objeto de negocio principal.

Debe:

- estar en inglés
- ir en `snake_case`
- ser estable en el tiempo
- describir el hecho o entidad, no la pantalla

Ejemplos buenos:

- `absence_request`
- `employee_novelty`
- `case`
- `case_followup`
- `payroll_run`
- `medical_leave`

Ejemplos malos:

- `formulario1`
- `pantalla_rrhh`
- `tabla_nueva`
- `registro_varios`

---

### 3.4 `role`

Aclara el papel semántico de la tabla.

Valores recomendados:

- `core` = identidad mínima
- `profile` = atributos descriptivos
- `event` = evento puntual
- `request` = solicitud
- `detail` = detalle transaccional
- `header` = cabecera transaccional
- `status` = estado actual
- `audit` = auditoría
- `bridge` = puente o relación operativa

Regla:

- el `role` debe agregar contexto real
- no repetir lo mismo que ya dice `entity`

Ejemplo correcto:

```text
tthh_fact_absence_request_cur
```

Ejemplo menos útil:

```text
tthh_fact_absence_absence_cur
```

---

### 3.5 `temporal`

Define el comportamiento temporal.

Valores oficiales:

- `scd0` = sin historia
- `scd2` = con historia versionada
- `cur` = estado actual o salida operativa actual
- `log` = secuencia histórica tipo bitácora o journal

Regla simple:

- catálogos estables: `scd0`
- entidades con historia de cambios: `scd2`
- formularios o registros vivos operativos: `cur`
- trazas o bitácoras: `log`

---

## 4. Regla del esquema

En esta versión simple, todo vive en:

```sql
public
```

Por tanto, la organización semántica depende completamente del nombre de la tabla.

Ejemplo:

```sql
public.tthh_fact_absence_request_cur
public.nomina_fact_employee_novelty_cur
public.ttss_fact_case_followup_cur
```

Regla:

- no depender del esquema para separar módulos
- el prefijo `domain` debe dejar claro quién es dueño funcional de la tabla

---

## 5. Regla simple para tablas transaccionales de formularios

Cuando una tabla nazca de un formulario, no debe nombrarse por la pantalla sino por el hecho de negocio que registra.

### 5.1 Regla principal

Nombrar la tabla por lo que el usuario registra realmente.

Ejemplos:

- solicitud de ausencia → `tthh_fact_absence_request_cur`
- novedad de nómina → `nomina_fact_employee_novelty_cur`
- apertura de caso social → `ttss_fact_case_intake_cur`
- seguimiento de caso → `ttss_fact_case_followup_cur`
- visita domiciliaria → `ttss_fact_home_visit_event_cur`

### 5.2 Regla operativa

Si el formulario genera un solo registro principal, usar normalmente:

```text
<domain>_fact_<entity>_<role>_cur
```

Si el proceso tiene cabecera y detalle:

```text
<domain>_fact_<entity>_header_cur
<domain>_fact_<entity>_detail_cur
```

Ejemplo:

```text
nomina_fact_payroll_adjustment_header_cur
nomina_fact_payroll_adjustment_detail_cur
```

### 5.3 Regla de historia

Si luego necesitas conservar versiones del registro maestro, puedes migrar a `scd2` para la entidad principal, pero los eventos capturados por formularios normalmente siguen siendo `fact_*_cur` o `fact_*_log` según el caso.

---

## 6. Regla para tablas maestras o catálogos

Usar `dim` o `ref` según el nivel de separación que realmente quieras.

### Opción simple recomendada

Para la mayoría de módulos operativos, basta con `dim`.

Ejemplos:

```text
tthh_dim_employee_profile_scd2
nomina_dim_payroll_item_scd0
ttss_dim_case_type_scd0
common_dim_document_type_scd0
```

### Opción más estricta

Si quieres separar identidad mínima y atributos:

```text
tthh_ref_employee_core_scd2
tthh_dim_employee_profile_scd2
```

Pero si no necesitas esa separación todavía, no la fuerces.

---

## 7. Regla para relaciones y asignaciones

Cuando una tabla represente una relación entre dos entidades, usar `asgn`.

Ejemplos:

```text
tthh_asgn_employee_supervisor_bridge_scd2
tthh_asgn_employee_contract_bridge_scd2
ttss_asgn_case_professional_bridge_scd2
```

Si la relación es solo técnica y muy simple, también puede resolverse dentro de una `fact`, pero si la relación tiene vigencia propia, `asgn` es mejor.

---

## 8. Convención mínima recomendada por subárea

### 8.1 Talento humano general

```text
tthh_dim_employee_profile_scd2
tthh_fact_absence_request_cur
tthh_fact_employee_onboarding_cur
tthh_fact_employee_exit_cur
tthh_asgn_employee_position_bridge_scd2
```

### 8.2 Nómina

```text
nomina_dim_payroll_item_scd0
nomina_fact_payroll_run_cur
nomina_fact_employee_novelty_cur
nomina_fact_payroll_adjustment_cur
nomina_fact_payroll_payment_cur
```

### 8.3 Trabajo social

```text
ttss_dim_case_type_scd0
ttss_fact_case_intake_cur
ttss_fact_case_followup_cur
ttss_fact_home_visit_event_cur
ttss_asgn_case_professional_bridge_scd2
```

### 8.4 Compartidas dentro de la base

```text
common_dim_document_type_scd0
common_dim_status_catalog_scd0
common_map_reason_code_catalog_scd0
common_log_api_sync_log
```

---

## 9. Reglas de estilo obligatorias

### 9.1 Idioma

- nombres canónicos en inglés
- prefijos funcionales pueden mantenerse como abreviaturas internas estables (`tthh`, `nomina`, `ttss`)

### 9.2 Formato

- todo en minúsculas
- usar `snake_case`
- sin espacios
- sin tildes
- sin caracteres especiales

### 9.3 Estabilidad

- no meter fechas en el nombre
- no meter versión en el nombre salvo que sea una transición temporal controlada
- no meter nombres de pantallas, tabs o botones

### 9.4 Simplicidad

- no crear más segmentos de nombre de los necesarios
- si `entity` ya explica bien el objeto, no sobrecargar `role`

---

## 10. Patrones recomendados rápidos

### Registro operativo simple

```text
<domain>_fact_<entity>_cur
```

Ejemplo:

```text
tthh_fact_absence_request_cur
```

### Registro operativo con rol más claro

```text
<domain>_fact_<entity>_<role>_cur
```

Ejemplo:

```text
ttss_fact_case_intake_cur
```

### Maestro estable

```text
<domain>_dim_<entity>_profile_scd0
```

Ejemplo:

```text
nomina_dim_payroll_item_profile_scd0
```

### Maestro con historia

```text
<domain>_dim_<entity>_profile_scd2
```

Ejemplo:

```text
tthh_dim_employee_profile_scd2
```

### Relación con vigencia

```text
<domain>_asgn_<entity>_<role>_scd2
```

Ejemplo:

```text
tthh_asgn_employee_supervisor_bridge_scd2
```

### Bitácora

```text
<domain>_log_<entity>_<role>_log
```

Ejemplo:

```text
common_log_integration_api_log
```

---

## 11. Regla práctica de decisión

Antes de crear una tabla, responder estas preguntas:

1. ¿Qué área o subárea es dueña? → `domain`
2. ¿Es catálogo, evento, relación, mapeo o log? → `kind`
3. ¿Qué objeto de negocio representa? → `entity`
4. ¿Qué papel exacto cumple? → `role`
5. ¿Tiene historia, estado actual o bitácora? → `temporal`

Si no puedes responder eso con claridad, el nombre todavía no está bien definido.

---

## 12. Regla final recomendada

Para mantenerlo simple y escalable:

- usar solo `public`
- ordenar todo por prefijo funcional
- usar siempre la forma:

```text
<domain>_<kind>_<entity>_<role>_<temporal>
```

- nombrar formularios por el hecho de negocio, no por la pantalla
- usar `fact` para registros transaccionales
- usar `dim` para maestros
- usar `asgn` para relaciones con vigencia
- usar `log` para bitácoras

Este canon es suficiente para empezar bien, crecer ordenado y mantener todo a la mano sin depender de múltiples esquemas.
