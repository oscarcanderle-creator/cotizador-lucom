# Migración histórica PGL

## 1. Objetivo

Este módulo permite migrar a PGL el histórico proveniente de:

- `VENTAS LUCOM.xlsx` — BAF / FWA
- `Portabilidad Lucom.xlsx` — PORTA / Línea Nueva

La migración está diseñada para poder repetirse antes de la puesta en producción definitiva de PGL.

No utiliza las validaciones operativas normales de la aplicación. Posee reglas específicas para datos históricos y realiza la carga mediante funciones SQL/RPC exclusivas para migración.

## 2. Principio de migración

Cada fila válida del archivo histórico genera:

- 1 operación PGL
- 1 producto asociado

No se reconstruyen operaciones multiproducto históricas.

Si una venta histórica comercialmente estaba compuesta por BAF + PORTA pero aparece como una fila en cada archivo, se importan como dos operaciones independientes.

Las operaciones multiproducto nativas de PGL se utilizan para operaciones creadas normalmente desde PGL.

## 3. Trazabilidad e idempotencia

Cada registro importado queda asociado a:

- lote de importación
- archivo/origen
- fila de origen
- operación creada
- cliente
- domicilio
- producto
- valores originales relevantes
- advertencias
- datos originales

La tabla principal de trazabilidad es `migracion_historica_registros`.

La identificación `(origen, fila_origen)` evita importar accidentalmente dos veces la misma fila histórica.

Los IDs históricos son determinísticos:

- `HIST-BAF-xxxxxx`
- `HIST-MOVIL-xxxxxx`

## 4. Archivos de origen

Por defecto los scripts buscan los archivos actuales en la carpeta `Downloads`.

También pueden indicarse archivos diferentes sin modificar el código mediante:

- `--archivo-baf`
- `--archivo-movil`

Para la importación definitiva se recomienda indicar explícitamente ambos archivos para garantizar que inspección, validación, dry-run e importación utilicen exactamente las mismas fuentes.


## 5. Scripts y ejecución

### Inspección
`node scripts/migracion-historica/inspeccionar.mjs`

### Validación
`node scripts/migracion-historica/validar.mjs`

### Preparación del catálogo
`node scripts/migracion-historica/preparar-catalogo.mjs`

### Dry-run
`node scripts/migracion-historica/importar.mjs`

El modo normal es DRY RUN y no escribe operaciones en Supabase.

### Prueba controlada
`node scripts/migracion-historica/importar.mjs --prueba-importacion`

Importa 1 BAF, 1 FWA, 1 PORTA y 1 LINEA_NUEVA. No realiza rollback automático.

### Importación real
`node scripts/migracion-historica/importar.mjs --importar`

### Reanudar un lote
`node scripts/migracion-historica/importar.mjs --reanudar-lote ID_LOTE`

La importación y la reanudación exigen confirmación textual antes de comenzar.


## 6. Clasificación histórica

Los productos históricos se clasifican como BAF, FWA, PORTA o LINEA_NUEVA.

FWA proviene históricamente del archivo BAF, pero queda identificado como subtipo FWA en PGL.

Para Línea Nueva se conserva por separado:
- numero_linea: prioritariamente PIN/LNVA NRO
- nim: NIM histórico
- pin_lnva_nro: PIN/LNVA NRO

NIM y PIN/LNVA no deben fusionarse.

## 7. Estados históricos

Los estados se adaptan solamente cuando existe una equivalencia válida con PGL. No se inventan estados actuales para completar información histórica.

Las ventas concretadas reciben validación estricta:
- BAF: CARGADO
- PORTA: ACTIVA NRO PORTADO
- Línea Nueva: LINEA NUEVA ACTIVA
- Línea Nueva: LINEA NUEVA ACTIVA S/LEGAJO

Los registros no concretados pueden conservar datos incompletos sin bloquear toda la migración.

## 8. Vendedores y origen histórico

Los prefijos forman parte de la identidad histórica. No se deben unificar vendedores solamente por nombre.

Por ejemplo, L1 Jeremias y J1 Jeremias son vendedores diferentes.

PSR_ indica origen PSR y no crea otro vendedor. Se elimina el prefijo para resolver la identidad y se conserva el Prospector en observaciones/trazabilidad.

LT identifica vendedor de Terreno.

Para RL/LT:
1. LT Nombre + email conserva identidad LT.
2. RL Nombre + email con un LT histórico del mismo nombre y email se transforma a LT Nombre.
3. RL Nombre sin LT equivalente se transforma a L1 Nombre.

La equivalencia por email se utiliza solamente para esta reconstrucción RL/LT. El email no es una clave general de identidad.

Identidad del vendedor y origen comercial son independientes:
- PSR tiene prioridad como origen PSR.
- LT tiene origen Terreno.
- RL con Origen del Dato informado conserva ese origen.
- RL con Origen del Dato vacío reconstruye origen Redes Lucom.

Vendedor, Responsable y BBOO son campos diferentes y no deben unificarse automáticamente.

Si una identidad histórica no puede asociarse inequívocamente a un usuario actual, se conserva en trazabilidad sin crear usuarios ficticios.


## 9. SDS y Orden de Trabajo históricos

Las validaciones operativas normales de PGL permanecen estrictas. La migración histórica no modifica ni elimina esas restricciones.

Para BAF histórico:

SDS:
- vacío: NULL operativo
- duplicado histórico: NULL operativo
- único: se conserva

Orden de Trabajo:
- vacío: NULL operativo
- formato inválido: NULL operativo
- duplicado histórico: NULL operativo
- válido y único: se conserva

Los valores originales siempre permanecen en la trazabilidad como sds_original y orden_trabajo_original.

Nunca se agregan sufijos ni se altera artificialmente el SDS u OT original.

## 10. Fechas históricas

Las fechas provenientes de Excel se conservan como fechas históricas.

No debe aplicarse manualmente una corrección de +3 o -3 horas a los timestamps procesados por ExcelJS.

El importador histórico carga directamente las fechas y no utiliza las automatizaciones de fecha de la API operativa normal de PGL.

## 11. Resultado de la migración inicial validada

Distribución final:
- BAF: 5.936
- FWA: 33
- PORTA: 4.339
- LINEA_NUEVA: 1.737
- TOTAL: 12.045

Control estructural:
- operaciones: 12.045
- operaciones con un producto: 12.045
- operaciones sin producto: 0
- operaciones multiproducto: 0

El lote inicial quedó completamente importado luego de reanudar los registros inicialmente bloqueados por SDS/OT históricos.

## 12. Correcciones pendientes en la fuente

Antes de la importación definitiva deben revisarse cuatro ventas de Línea Nueva activa cuya Fecha Carga STL está vacía en la fuente:

- fila móvil 4351
- fila móvil 4578
- fila móvil 5176
- fila móvil 5178

La migración actual no inventó esas fechas.

Si se determina la fecha correcta, debe corregirse en la fuente original y en el Excel que se utilice para la importación definitiva.

Las filas 5176 y 5178 no deben deduplicarse automáticamente: corresponden a líneas diferentes y poseen datos de línea/SIM diferentes.

Cualquier otra corrección manual debe limitarse a errores evidentes de la fuente. Los datos históricos legítimos no deben modificarse solamente para satisfacer validaciones actuales de PGL.


## 13. Reemplazo de una migración histórica anterior

Si posteriormente se corrigen los Excel y se desea realizar una nueva importación definitiva, debe tenerse en cuenta la idempotencia por (origen, fila_origen).

Mientras exista la trazabilidad de una fila ya importada, el importador la reconocerá como existente y no la volverá a crear.

Por lo tanto, si se desea reemplazar completamente una migración histórica anterior, primero debe retirarse exclusivamente el lote histórico que se quiere sustituir.

Nunca se deben truncar las tablas operativas si PGL ya contiene operaciones reales.

El mecanismo previsto es:

revertir_lote_migracion_historica(ID_LOTE)

El ID del lote debe verificarse en la base antes de ejecutar cualquier rollback. Nunca debe quedar hardcodeado un ID específico como procedimiento permanente.

El rollback debe ejecutarse solamente:
1. después de identificar exactamente el lote histórico
2. después de verificar un backup
3. cuando exista decisión explícita de reemplazar esa migración

Las operaciones normales creadas en PGL después de la migración histórica no deben eliminarse.

## 14. Procedimiento para la importación definitiva

1. Corregir solamente errores confirmados en las fuentes.
2. Exportar los dos Excel definitivos.
3. No modificar esos archivos durante el proceso.
4. Realizar y verificar backup de Supabase.
5. Identificar el lote histórico anterior que se desea reemplazar.
6. Si corresponde, revertir exclusivamente ese lote.
7. Ejecutar inspección sobre ambos Excel.
8. Ejecutar validación.
9. Preparar catálogo si aparecen valores históricos nuevos.
10. Ejecutar dry-run utilizando exactamente los mismos archivos.
11. Confirmar que existan 0 payloads inválidos.
12. Revisar cantidades BAF, FWA, PORTA y Línea Nueva.
13. Ejecutar la importación real.
14. Si existen errores parciales, corregir la causa y utilizar --reanudar-lote.
15. Auditar cantidades finales.
16. Verificar que cada operación histórica tenga exactamente un producto.
17. Verificar estados y fechas de las ventas concretadas.
18. Conservar lote y trazabilidad como evidencia permanente de la migración.

## 15. Regla de seguridad

El importador histórico es una herramienta administrativa y técnica.

No debe exponerse como funcionalidad normal para vendedores ni utilizarse para crear operaciones cotidianas.

Las validaciones históricas tolerantes existen exclusivamente para reconstruir información anterior a PGL.

Las operaciones nuevas deben continuar utilizando las validaciones normales de la aplicación.
