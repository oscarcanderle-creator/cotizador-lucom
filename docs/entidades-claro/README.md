# Maestro de Entidades Claro — PGL

Cierre técnico: 27/11/2026 (Argentina). Ruta: /admin/entidades-claro.

## Fuentes y alcance

Los CSV adjuntos conservan las exportaciones de Supabase de las definiciones de funciones y del catálogo de estructura y permisos. Son documentación de referencia, no migraciones ni backups de datos. Las firmas largas del inventario de permisos aparecen truncadas en la exportación; consultar las definiciones completas en funciones-supabase.csv.

## Modelo

- entidades_claro: titulares, tipo CALL/TERRENO/BBOO/PDV/AGENCIA, estado, DNI, fechas, vínculos a profiles, puntos_venta y asesores_pdv.
- entidades_claro_codigos: relación N:1 con titular, tipos IDENTITY, ENTIDAD_HIJA, POS_1175, SUBAGENTE; estado y fechas actuales.
- entidades_claro_vigencias: relación N:1 con código, períodos y motivos de apertura/cierre.
- entidades_claro_historial: auditoría INSERT/UPDATE/DELETE, tabla, registro, usuario, JSON anterior/nuevo y fecha.

Inventario: 4 tablas, 39 columnas, 17 índices, 19 restricciones, 8 triggers y 12 funciones. Las FK de códigos y vigencias impiden borrados de padres con dependencias. Los vínculos a PDV y asesor son RESTRICT; el vínculo a profile es SET NULL.

## Reglas comerciales

- Titulares activos CALL, TERRENO, BBOO y AGENCIA requieren al menos una identidad comercial activa (IDENTITY o ENTIDAD_HIJA). PDV no está sujeto a esta exigencia: puede operar con POS_1175 y SUBAGENTE.
- PDV y asesores vinculados se consultan en este maestro; su gestión no debe duplicarse mediante las acciones destinadas a titulares no PDV.
- CALL y TERRENO requieren perfil vinculado. La creación valida perfil activo y correspondencia de tipo; la edición permite conservar un perfil inactivo ya vinculado si corresponde al tipo.
- DNI opcional de 7 u 8 dígitos; sincronización con perfil vinculado mediante trigger.
- IDENTITY y ENTIDAD_HIJA comparten unicidad normalizada (upper/btrim); POS_1175 tiene unicidad independiente. La baja no libera el código para otro titular.
- Alta individual de códigos: IDENTITY (AGE/AGET/AGEP seguido de dígitos) o POS_1175 (dígitos). Se preservan ceros iniciales. Las funciones de alta/corrección de identidad comprueban también colisiones con identidad numérica sin prefijo.
- Baja del último IDENTITY sin otra identidad activa implica baja del titular. La baja individual de identidad no puede dejar discontinuidad de cobertura comercial.
- Baja de titular cierra todas sus vigencias activas. Reactivación de titular exige selección de códigos, incluyendo al menos una identidad; solo reactiva los seleccionados.
- Alta individual, baja y reactivación requieren motivo y fecha; control de fecha futura en Argentina y coherencia con altas, bajas y reactivaciones anteriores según la función.
- Vigencias con intervalos [desde,hasta), sin superposición por código (EXCLUDE GiST) y máximo una abierta por código. Los datos históricos pueden tener fecha inicial desconocida (NULL); no inventar fechas.
- Corrección de código modifica su valor conservando vigencias y registra auditoría; no equivale a baja y alta.

## Funciones

| Función | Responsabilidad |
|---|---|
| crear_entidad_claro | Alta de titular e identidad inicial, POS opcional |
| editar_entidad_claro | Edición de datos y vínculo |
| agregar_codigo_claro | Alta de código y motivo de apertura |
| editar_codigo_claro | Corrección de código y auditoría |
| dar_baja_codigo_claro | Cierre de vigencia y baja individual o del titular |
| dar_baja_entidad_claro | Baja integral del titular |
| reactivar_codigo_claro | Nueva vigencia de código |
| reactivar_entidad_claro | Reactivación selectiva de códigos |
| actualizar_fecha_entidades_claro | Actualización de updated_at |
| crear_vigencia_codigo_claro | Vigencia inicial automática |
| registrar_historial_entidades_claro | Auditoría automática |
| sincronizar_dni_desde_entidad_claro | Sincronización DNI con profiles |

Las funciones de negocio validan ADMIN activo mediante auth.uid(). No asumir que todas tienen idénticas validaciones: crear_entidad_claro no contiene explícitamente los controles de fecha futura ni regex de POS de agregar_codigo_claro; editar_entidad_claro no comprueba explícitamente fecha de alta contra todas las vigencias históricas. La corrección individual existe en SQL; su exposición en interfaz no se certifica en este cierre.

## Seguridad y aplicación

RLS habilitada (no forzada) en las cuatro tablas, sin políticas registradas en el inventario. Permisos directos de tablas para postgres y service_role; no para anon ni authenticated. RPC de negocio con EXECUTE para authenticated y validación interna de ADMIN. Consultas privilegiadas de aplicación únicamente tras comprobar sesión y rol ADMIN activo; las mutaciones RPC utilizan cliente de sesión para conservar auth.uid(). Las funciones fijan search_path vacío; todas salvo actualizar_fecha_entidades_claro son SECURITY DEFINER.

Historial automático de cambios en titulares, códigos y vigencias. Las acciones de negocio añaden eventos específicos dentro de datos JSON. La interfaz muestra historial de titulares y períodos de códigos, sin editar auditoría.

## Validación de cierre

- Nueve validaciones de fechas y seis de integridad temporal superadas según ejecución informada.
- Prueba de duplicidad rechazada; historial de titulares y códigos revisado en interfaz.
- TypeScript y build de producción superados antes de los commits exclusivamente documentales.
- Titular de prueba PDV PATIO OLMOS (tipo AGENCIA, sin vínculos) eliminado junto con sus dos códigos y vigencias; verificación posterior 0/0/0. Se mantuvo la auditoría.
- Cinco controles finales: cero titulares no PDV activos sin identidad activa; cero códigos activos de titulares inactivos; cero códigos activos sin vigencia abierta; cero códigos inactivos con vigencia abierta; cero códigos sin historial de vigencias.
- Villa Allende Seculin es un PDV con POS y SUBAGENTE activos: excepción legítima al requisito de identidad de titulares no PDV. No se modificó.
- No se certifica aquí una prueba negativa de acceso no ADMIN ni todas las mutaciones exitosas desde interfaz; las validaciones SQL no sustituyen esas pruebas.

Pendiente al momento de documentar: integración con main, despliegue y comprobación en producción.
