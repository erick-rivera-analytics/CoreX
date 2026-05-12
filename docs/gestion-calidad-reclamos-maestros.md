# Gestion - Comercial/Calidad/General - Estructura para Reclamos

## Objetivo

Separar correctamente el flujo transaccional de reclamos de sus catalogos maestros y del frente analitico:

- `Administracion > Maestros por dominio > Ventas`
- `Administracion > Maestros por dominio > General`
- `Administracion > Maestros por dominio > Calidad`
- `Gestion > Comercial > Reclamos` como modulo transaccional
- `Analitica > Calidad > Reclamos` como visualizador estadistico posterior

## Fuente funcional inicial

Archivo base de parametrizacion:

- `C:\Users\paul.loja\Downloads\Selecionables_APP_Reclamos.xlsx`

Hojas detectadas:

- `Calidad`
- `Comercial`

Resumen inicial observado:

- Clientes: `198`
- Comercializadoras: `3`
- Fincas: `2`
- Ejecutivos de cuenta: `9`
- Productos/variedades: `7`
- Tipos de problema Calidad: `5`
- Problemas Calidad: `35`
- Tipos de problema Comercial: `3`
- Problemas Comercial: `14`

## Modulos definidos

### Ventas

- `Clientes`
- `Comercializadoras`
- `Ejecutivos de cuenta`

### General

- `Fincas`
- `Variedades`

Semilla inicial del maestro:

- `Xlence (XLE)`
- `Cloud (CLO)`
- `Zinzi (ZIN)`

### Comercial

- `Problemas de reclamo`

### Postcosecha

- `Destinos`
- este maestro alimenta el campo visual `Proceso` dentro de `Comercial > Reclamos`
- debe incluir la opciÃ³n `NA / No aplica`

### Gestion / Comercial

- `Reclamos`
- frentes iniciales: `Registro`, `Aprobaciones`, `Aplicaciones`

### Analitica / Calidad

- `Reclamos`
- visualizador posterior: alertas, notas de credito, motivos, estados y cortes por calidad/comercial

## Decisiones de diseno

### Problemas de reclamo

Se registran en:

- `Administracion > Maestros por dominio > Comercial > Problemas de reclamo`

Modelo:

- `family` = tipo de problema
- `subfamily` = problema

Alcance:

- `quality`
- `commercial`
- `all`

Esto permite reutilizar un solo arbol para reclamos por calidad y reclamos comerciales sin duplicar modulos.

### Productos del Excel / Variedades

La columna `Producto` del Excel se tratara inicialmente como catalogo manual de `Variedades`, hasta que se defina una vinculacion mas fina con fuente corporativa o maestros de postcosecha.

### Destinos

Se crea como maestro de `Postcosecha` para soportar el selector visual `Proceso` en reclamos. Debe incluir `NA / No aplica`, aunque la relacion final con destinos operativos de postcosecha quede pendiente.

### Fincas

Se registran de forma manual en `General` para desbloquear el flujo de reclamos y permitir reutilizacion posterior en otros dominios. Mas adelante pueden migrarse o vincularse a una fuente maestra de Campo.

### Reclamos transaccionales

El modulo operativo vive en `Comercial > Reclamos`.

Reglas base:

- `Reclamo por` = `Calidad` o `Comercial`
- `Aplica nota de credito` = `Si` o `No aplica`
- si `No aplica`, el registro cubre la alerta y no entra a `Aprobaciones` ni `Aplicaciones`
- si `Si`, el flujo entra a `Pending approval`, luego `Approved/Rejected`, y si aprueba pasa a `Pending application`

Subfrentes:

- `Registro`: crea el reclamo unico y decide si es nota de credito o alerta
- `Aprobaciones`: solo ve registros con nota de credito pendientes de aprobacion
- `Aplicaciones`: solo ve registros aprobados y pendientes de aplicar

### Reclamos analiticos

El frente `Calidad > Reclamos` no es operativo. Su objetivo es mostrar despues:

- alertas de calidad
- notas de credito por calidad y comercial
- motivos y problemas
- estados del proceso
- cortes por cliente, ejecutivo, comercializadora y periodo

## Base de datos

Bases destino:

- `db_general` para `General / Fincas` y `General / Variedades`
- `db_calidad` para `Ventas` y `Comercial / Problemas de reclamo`
- `db_postharvest` para `Postcosecha / Destinos`

## Estructura de tablas maestras

### Ventas - maestros simples

- `public.sls_ref_account_executive_id_core_scd2`
- `public.sls_dim_account_executive_profile_scd2`
- `public.sls_ref_customer_id_core_scd2`
- `public.sls_dim_customer_profile_scd2`
- `public.sls_ref_commercializer_id_core_scd2`
- `public.sls_dim_commercializer_profile_scd2`

### General - maestros simples

- `public.gnl_ref_variety_id_core_scd2`
- `public.gnl_dim_variety_profile_scd2`
- `public.gnl_ref_farm_id_core_scd2`
- `public.gnl_dim_farm_profile_scd2`

### Postcosecha - proceso / destino

- `public.postharvest_ref_destination_id_core_scd2`
- `public.postharvest_dim_destination_profile_scd2`

### Comercial - arbol de problemas

- `public.sls_ref_claim_problem_id_core_scd2`
- `public.sls_dim_claim_problem_profile_scd2`

## Pendientes de negocio

- Definir si `Variedades` se alimentara despues desde fuente oficial o seguira manual.
- Definir la relacion final entre `Proceso` de ventas y `Destino` de postcosecha.
- Definir si `Fincas` quedara como maestro general manual o se consumira desde Campo.
- Definir la estrategia definitiva de fotos del modulo transaccional de reclamos.
- Definir el modelo relacional final para cabecera de reclamo, estados, aprobaciones y aplicaciones.

