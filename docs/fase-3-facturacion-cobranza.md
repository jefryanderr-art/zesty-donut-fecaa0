# Fase 3: estado de la solicitud actual

Esta fase no se inició porque la Fase 2 no está cerrada. No se implementaron correos de documentos del cliente final, plantillas por empresa, enlaces de WhatsApp nuevos, reglas de cobranza, promesas de pago, términos/descuentos ni enlace de emisión recurrente entre Q y Contratos. No existen rutas o pantallas nuevas que aparenten ofrecerlos. No se activaron envíos ni se añadieron tareas programadas.

La causa es implementación de la solicitud sin concluir, no una imposibilidad técnica demostrada ni una excepción autorizada por el dueño. El registro de estos faltantes no equivale a cumplir la exigencia de cerrar todo en la misma tarea. Se conservaron los componentes previos de Fase 1, los límites de crédito existentes, Q, Contratos, los comprobantes de Pagadito y la cola de correo del servicio; no satisfacen por sí solos los entregables nuevos de Fase 3.

## Lista real y continuación

- [ ] F3.1a Documento del cliente final (factura, cotización, proforma y estado de cuenta) con PDF adjunto y cola idempotente: falta generar instantánea autorizada por empresa/sucursal, encolarla en la transacción y adaptar la entrega existente sin reenvíos automáticos ambiguos.
- [ ] F3.1b Plantillas por empresa, historial enviado/error/reintento y alternativa `wa.me`: falta persistencia protegida de plantillas/eventos y controles explícitos de envío/reintento. No afirmar entrega solo por encolar.
- [ ] F3.2a Reglas configurables antes/después de vencimiento y recordatorios para aprobación: falta cálculo de candidatos autorizado, pantalla de revisión y confirmación individual. No usar envío ciego.
- [ ] F3.2b Estado de cuenta, promesas e historial: falta módulo con saldos vinculados, fichas inmutables, permisos y descargas PDF/CSV auditadas.
- [ ] F3.2c Límite de crédito con advertencia/bloqueo: falta configuración nueva y validación confirmada en el emisor, conservando límites y conducta histórica mientras no se active.
- [ ] F3.3 Términos y descuentos por pronto pago: falta instantánea hacia adelante en la factura, recálculo compartido al cobrar, asiento de descuento y control de aplicación única; no modificar documentos emitidos.
- [ ] F3.4 Emisión ligada a Q y Contratos: falta vínculo explícito sin conversión histórica, vista de próximas emisiones, vista previa y confirmación sin cargo automático.
- [ ] F3.Cierre Permisos/planes/sucursales, revisión/idempotencia, pruebas escritas, uiT, respaldo/PDF completo, descargas y documentación de archivos modificados.

## Migraciones, archivos y reversión

No hubo archivos operativos modificados por esta fase ni migraciones nuevas. Este documento solo registró el alcance ausente. No se requiere revertir datos de Fase 3 porque no se añadieron. Conservar cola, pagos, documentos, numeraciones y funciones previas. Una futura implementación deberá usar migraciones aditivas solo si cambia el esquema y mantener sus tablas durante cualquier reversión.

## Comprobaciones de vista previa para la futura implementación

Estas comprobaciones no se ejecutaron y los comportamientos nuevos no están disponibles:

1. Matriz de cuatro planes, dueño y colaboradores sin acceso/lectura/escritura, soporte y empresas limitadas; probar URL/API directa, empresa ajena, sucursal ajena y consolidado de consulta.
2. Correo por cada tipo de documento con SMTP ausente, rechazo explícito, aceptación y timeout ambiguo: no afirmar entrega antes de confirmación ni reintentar estados ambiguos. Dos solicitudes idénticas deben dejar una sola operación en cola. Verificar que el PDF contiene únicamente la empresa, cliente y sucursal autorizados.
3. Aprobar y rechazar recordatorios; no enviar por consultar, abrir una vista, generar candidatos o ejecutar las tareas existentes sin aprobación. Probar vencimientos civiles en America/Managua.
4. Registrar promesas e historial sin cambiar deuda; comprobar límite en advertencia y bloqueo, llamadas API directas, saldos concurrentes y facturas previas a la activación.
5. Descuentos dentro/fuera de plazo, cobro parcial/final, notas de crédito, centavos y reversión. No aplicar dos veces ni recalcular históricos.
6. Vincular contrato/Q explícitamente, consultar próximas emisiones y confirmar dos veces: una sola factura. Pausa/cancelación y restauración no deben crear cargos ni emisiones tácitas.
7. PDF/CSV y JSON/ZIP/PDF completo con empresa, período, autor, fecha y versión, bitácora y escape de datos. Revisar teléfono/laptop, claro/oscuro, teclado y controles sin superposición con `.bnav`.
