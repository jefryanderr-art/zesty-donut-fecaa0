# Comprobantes y correo de pagos

Se reutilizan `acontec_customer_payments`, `acontec_service_messages`, la sincronización actual y jsPDF. La migración `add_payment_receipt_details` solo añade columnas; no modifica filas históricas ni migraciones aplicadas. No se crea otra suscripción ni otro almacenamiento. El retorno y la sincronización programada convergen en `syncCheckout`; el webhook conserva su verificación criptográfica y aporta `resource.reference` únicamente después de verificar su firma y consultar el estado en Pagadito.

## Configuración

En Netlify, con alcance Functions y contexto correspondiente, configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`. El puerto predeterminado es 465 (TLS); 587 usa negociación STARTTLS de nodemailer. La consulta de presencia realizada durante esta entrega encontró `SMTP_USER` ausente en production y deploy-preview; las otras cuatro variables estaban presentes. La presencia no acredita credenciales válidas ni entrega SMTP. No se cambiaron variables ni se contrataron servicios.

Se conservan `PAGADITO_ENV`, `PAGADITO_UID` y `PAGADITO_WSK`. El entorno activo procede de la configuración existente; cada pago conserva su entorno independiente. Cambiar el entorno no cambia los pagos anteriores. Los comprobantes y correos muestran «PAGO DE PRUEBA» exclusivamente cuando el entorno guardado es sandbox. La contabilidad y el cálculo de acceso conservan sus controles actuales.

## Consulta y datos históricos

`GET /api/payments` devuelve únicamente pagos del correo de la sesión, sin tokens. `GET /api/payment-receipt?id=<uuid>` exige el mismo correo y estado confirmado. Se utilizó esta ruta para conservar `/api/receipt`, que ya corresponde a comprobantes fiscales. El historial incluye todos los entornos y distingue los de prueba. Los PDF pueden guardarse o imprimirse con un lector de PDF.

Los nuevos pagos guardan una instantánea con número interno estable, cliente, plan, periodicidad, cobertura (fin exclusivo), centavos, moneda, ERN, entorno y aprobación. La fecha de emisión es la hora de registro del pago en Acontec, presentada en America/Managua; no se presenta como una hora histórica del proveedor que no está disponible. Los pagos anteriores reciben metadatos adicionales al consultarse; no se reemplazan sus referencias previas ni sus importes. El ERN nunca sustituye al Número de Aprobación.

La consulta utiliza `data.pending_charges[].reference` de `get-status-recurring-payments`, ya utilizado por esta integración. La documentación pública de webhooks de Pagadito muestra `resource.reference`: https://dev.pagadito.com/index.php?mod=docs&hac=mostrar&tema=webhooks. Esta versión no usa `get-pending-payments-status`; no se añadió una llamada con un contrato supuesto. La comprobación real de las respuestas recurrentes en ambos entornos queda pendiente de despliegue. Si la consulta completada devuelve el cobro sin referencia, se registra su comprobación y se muestra «Número de Aprobación no disponible». Si la consulta falla, el número queda pendiente, sin declarar que el proveedor no lo tiene.

Un pago histórico de otro entorno con aprobación ya guardada permite descargar su comprobante sin consultar al proveedor. Cuando falta la aprobación, no se utilizan credenciales de producción para consultar pagos de sandbox: se conserva visible el pago y la descarga solicita restaurar la configuración correspondiente para recuperar su aprobación. No es posible recuperar datos omitidos por el almacenamiento histórico con credenciales del otro entorno.

## Cola y duplicados

La clave única `receipt:<paymentId>` y la reserva SQL con `FOR UPDATE SKIP LOCKED` impiden envíos concurrentes del mismo mensaje. La aceptación SMTP registra `sent_at` y `notified_at` en una transacción. El retorno y el webhook despachan un lote en segundo plano; la función programada existente reintenta hasta cinco intentos. Sin SMTP, no se consumen intentos ni se modifica la confirmación. Los errores guardados son categorías sin credenciales ni cuerpos privados.

SMTP no ofrece entrega exactamente una vez. Cuando se pierde la respuesta tras una posible aceptación, o el proceso se interrumpe durante un envío, el mensaje permanece `sending`; `SMTP_AMBIGUOUS_REVIEW_REQUIRED` indica el caso detectado. No se reenvía automáticamente: antes de reactivarlo debe comprobarse en el servidor SMTP el Message-ID estable `<messageId@acontec.company>`. Los rechazos explícitos y los fallos anteriores al envío vuelven a pending, hasta cinco intentos. Los mensajes con cinco intentos requieren revisión. No se afirma entrega al destinatario por el mero hecho de que SMTP haya aceptado el mensaje.

## Verificaciones posteriores al despliegue

1. Verificar la migración aditiva y los permisos RLS usando el rol real de Functions.
2. Configurar SMTP_USER y comprobar credenciales, remitente y entrega. Sin SMTP, confirmar que el pago continúa confirmado y el correo permanece pending sin consumir intentos.
3. En cada entorno, confirmar un primer pago y una renovación; revisar Número de Aprobación, fecha de emisión, cobertura, moneda y PDF adjunto. Solo sandbox debe contener «PAGO DE PRUEBA».
4. Hacer coincidir retorno, webhook y sincronización: comprobar un único mensaje por pago y notified_at después de aceptación SMTP. Simular rechazo SMTP explícito y comprobar límite de cinco intentos; revisar separadamente resultados ambiguos.
5. Con dos cuentas, comprobar 404 al pedir el UUID de la otra, y 401 sin sesión. Comprobar ausencia de tokens en historial y PDF.
6. Consultar historial antiguo, descargar e imprimir, cambiar de entorno y confirmar conservación y marcado de pruebas, sin ingresos ni acceso de producción por pagos sandbox.

Solo se realizó revisión estática, validación de sintaxis y revisión del diff. No se ejecutaron pruebas funcionales, servidores, compilaciones, cobros ni envíos SMTP. Se reutilizó la tarea diaria existente y no se añadió polling ni otra tarea programada.
