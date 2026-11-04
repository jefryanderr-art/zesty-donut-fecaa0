# Auditoría interna ampliada

La revisión se incorporó a Bitácora de auditoría y junto a Integridad contable. Conservó la bitácora acontec_audit_events y su comportamiento. Es ayuda interna, **no auditoría externa ni prueba legal**. Todo resultado se expresa como hallazgo que requiere revisión; verifica con tu contador.

El permiso propio `auditoria_revision` nació concedido al dueño y, cuando no existe una decisión explícita, al contador. Admite Sin acceso, Lectura y Escritura. Lectura permite historial/descargas; Escritura permite ejecutar y seguir hallazgos. El dueño cambia umbrales con confirmación y motivo. Cada regla requiere además lectura de sus fuentes y el plan vigente. Soporte temporal queda excluido; empresas excedidas conservan consulta. Se exige sucursal concreta, tomada de la sesión del servidor; no se ejecuta desde consolidado. Los informes guardan sus permisos de alcance y dejan de mostrarse si se pierde lectura de alguna de sus fuentes. La proyección genérica de datos aplica la misma restricción.

Cada ejecución guarda fecha, solicitante, versión 1, revisión origen, período, sucursal, alcance, umbrales, cobertura, hallazgos, referencias e identidades registradas. Los catálogos de productos, empleados y terceros representan el estado disponible al ejecutar: no se inventan fotografías históricas. Los movimientos se seleccionan por fecha. Los eventos de bitácora se delimitan en UTC y el horario se evalúa en la zona IANA configurada. Los puntajes suman por hallazgo único: alta 20, media 10 y baja 3, con tope de 100 por área e identidad. No son probabilidades ni conclusiones. Las reglas solapadas pueden sumar por detectar condiciones distintas; los hallazgos idénticos se deduplican.

## Reglas, umbrales y falsos positivos

Los montos de configuración se guardan como centavos enteros, no unidades monetarias. Son referencias internas sugeridas, no límites legales. Los salarios y montos no se recalculan ni se corrigen.

| Regla | Detección y sugerencia inicial | Falsos positivos y límites conocidos |
|---|---|---|
| sales-reversals | Al menos 3 notas de crédito, devoluciones referenciadas o reversas por identidad o turno en el período. | Un turno largo o una corrección en lote puede ser normal. No hay tasa sobre ventas; es frecuencia absoluta. |
| sales-discounts | Descuento de al menos 20%, o 3 ventas con descuento por identidad. | Campañas y contratos autorizados. |
| sales-prices | listPrice distinto de originalPrice conservado en la línea. | Negociación autorizada. No se compara contra el catálogo actual ni se confunde descuento con cambio de precio. Sin fotografía histórica no es evaluable. |
| document-sequence | Diferencia mayor de uno entre consecutivos de ventas de igual serie y sucursal, hasta el cierre del período. | Reservas, documentos fuera del sistema o series incompletas. Sin secuencia numérica no es evaluable. |
| document-hours | Emisión fuera de 07:00–19:00 o en fecha configurada como feriado. | Horarios extendidos, emisión diferida. Zona inicial America/Managua; no se inventa calendario oficial. Sin hora no es evaluable. |
| document-round | 3 ventas con igual importe positivo múltiplo de 10000 centavos. | Tarifas fijas o paquetes. |
| document-limit | 3 importes por identidad entre 95% y menos de 100% de 500000 centavos. | El límite de referencia no sustituye políticas reales ni bloquea ventas. |
| document-duplicate | Referencia, serie, sucursal, cliente e importe idénticos en más de una venta. | Referencias reutilizadas legítimamente. No se agrupan documentos sin referencia. |
| cash-shortage | 3 conteos con diferencia negativa por identidad. | Desfase de entrega o conteos corregidos por mecanismos existentes. |
| stock-adjustment | Ajuste o merma con movimiento absoluto de al menos 10 unidades. | La unidad del artículo importa; no equivale a un importe monetario. |
| stock-negative | Stock al cierre, reconstruido restando al stock actual los movimientos posteriores. | Importaciones históricas incompletas; no incluye servicios. No revaloriza existencias. |
| stock-cost | Costo de línea superior a 2 veces, o inferior a la mitad, de la mediana previa del producto, con al menos 3 observaciones. | Cambios de unidad, compras extraordinarias y cambios reales de costo. Sin historia suficiente no se emite hallazgo. |
| expense-receipt | Gasto sin archivo ni referencia, ni obligación fiscal asociada con archivo. | Referencia libre no acredita archivo; un archivo externo no registrado puede existir. |
| expense-new-supplier | Primer gasto visible de un proveedor con al menos 100000 centavos. | Se evalúa historia de la sucursal; proveedores nuevos y compras legítimas. Se usa ID y, si falta, la parte textual exacta. |
| ledger-month-end | Asiento manual en los últimos tres días del mes. | Ajustes normales de cierre. |
| ledger-reopen | Evento de reapertura registrado en bitácora. | Reaperturas autorizadas. No se reconstruyen eventos ausentes. |
| ledger-closed | Hora de emisión/creación posterior al cierre aún vigente de su mes. | Importaciones o cierres posteriores. Sin hora no es evaluable; no se confunde fecha contable anterior con creación posterior. |
| ledger-document | Asiento manual sin referencia, documento ni factura vinculada. | Provisiones o ajustes legítimos. |
| bank-old | Con Bancos activo y autorizado, fila bancaria sin entryId con al menos 90 días al cierre. | Partidas justificadas en tránsito. No se interpreta como saldo incorrecto ni se empareja nada. |
| access-hours | Evento de ingreso fuera del horario o en feriado. | Accesos autorizados; solo los ingresos que ya registra la bitácora. |
| access-permissions | Evento de creación/modificación de acceso o permisos. | Administración habitual. No se cambia el registro previo de accesos. |
| access-separation | Misma identidad registrada factura, emite corrección de su venta y registra un abono vinculado en el período. | Empresa pequeña con funciones acumuladas. No se presume identidad a partir de nombres parecidos; inconsistencias entre IDs y actores históricos pueden impedir correlación. |
| customer-overdue-discount | Venta con descuento a un cliente con otra venta a crédito vencida y pendiente, descontando abonos/notas vinculados hasta esa venta. | Acuerdos de pago o cobros históricos sin vincular. No reemplaza un estado de cuenta. |
| employee-third-party | Documento normalizado exacto de empleado coincide con cliente/proveedor. | Persona con relación legítima doble. No se comparan nombres. |
| employee-duplicate | Documento normalizado repetido entre empleados. | Expedientes históricos o reingresos; sin documento no es evaluable. |
| salary-range | Salario disponible fuera de 10000–1000000 centavos. | Puestos especiales, jornadas parciales o distintas monedas de referencia. No hay rangos legales incorporados. |
| payroll-file | Nómina pagada/cerrada sin empleado vinculado existente al día del pago. | Expediente histórico fuera de la aplicación. No exige completar retroactivamente campos. |

Las reglas muestran sus referencias e identidades disponibles. Una fuente sin permisos o campos esenciales se indica como no evaluable. La falta de hallazgos no acredita cobertura completa; campos ausentes en parte de los registros también limitan el resultado. No se crean hechos históricos ni se completan datos faltantes.

## Seguimiento y conservación

El informe original no se modifica. Cada seguimiento añade un registro con fecha, autor, estado, responsable, comentario y referencias a comprobantes existentes de la sucursal. Los estados son nuevo, en revisión, justificado, confirmado y descartado; los últimos tres cierran el hallazgo, exigen comentario y quedan conservados. El responsable debe ser dueño o miembro activo autorizado a esa sucursal. Los enlaces usan la descarga ya existente, que vuelve a validar sesión, módulo, sucursal y permisos del comprobante; conocer el ID no concede acceso al archivo. No se añaden cargas ni se copia contenido privado al informe.

El recordatorio mensual es optativo y se consulta al abrir el panel o la auditoría. Se basa en la última ejecución del mes UTC, no programa tareas ni manda correos. No hay llamadas a terceros ni IA.

## Persistencia, límites y comprobaciones

Las escrituras propias pasan por runOperation/updateCompany: transacción, bloqueo, revisión optimista, UUID idempotente, respaldo y bitácora. Se reutilizan businessRecords y cfg, con almacenamiento relacional/residual, RLS y respaldos existentes. No hubo cambios de esquema ni migraciones. La combinación especial del informe conserva exactamente las demás propiedades, orden de asientos, stock y asignaciones históricas; no usa el inicializador de operaciones ni materializa sucursales en esos registros. La bitácora y la revisión de empresa sí avanzan al guardar el informe, como metadatos de la operación.

Límites explícitos: período máximo de 367 días inclusivos, 50000 asientos disponibles, 10000 eventos por ejecución, 5000 hallazgos por informe y 20000 registros de negocio por empresa. Se rechaza exceder el límite; no se presenta un informe recortado como completo. Un historial anterior no se puede eliminar ni editar mediante guardado genérico o restauración. Restaurar una copia anterior que omita informes ya guardados se rechaza para conservar su inmutabilidad.

Se escribieron casos positivos y falsos positivos por cada regla y pruebas de no modificación, puntajes, permisos de fuentes e inmutabilidad. No se ejecutaron. La sesión solo verificó sintaxis y formato. Quedaron para validación de la plataforma: ejecución de pruebas, permisos efectivos, concurrencia/repetición del UUID, RLS, respaldos/restauración, tiempos con datos grandes, PDF/CSV y visualización móvil/oscura.
