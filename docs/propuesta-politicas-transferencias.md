# Propuesta documental: pagos por transferencia

Estado: propuesta para revisión del propietario. No se guardó ni publicó en el editor legal. Identificador propuesto para una futura versión conjunta de Términos, Privacidad y Reembolsos: `2026-11-pagos-2`.

Base consultada: documentos públicos vigentes en `/api/legal`, versión `2026-10-30-V-1`, revisión 3. Las secciones siguientes se proponen para agregar al final del documento correspondiente, conservando íntegro su texto anterior. Antes de usarlas debe comprobarse que la versión vigente no haya cambiado. Este archivo no sustituye los documentos publicados ni constituye aceptación de los usuarios.

## Adición a Términos: Métodos de pago

1. **Métodos disponibles.** El servicio puede pagarse por Pagadito, con los cobros descritos en la pantalla de pago, o por transferencia bancaria. Las disposiciones anteriores sobre procesamiento por Pagadito y autorización de cobros recurrentes se aplican a los pagos realizados por ese canal. La transferencia no es un cobro recurrente: el cliente debe pagar cada periodo.

2. **Pago por transferencia.** El cliente elige plan, periodo y moneda, y el sistema le muestra el monto exacto, la cuenta de destino y un código de referencia único, que debe indicar en la transferencia. Si el pago es en córdobas, el monto se calcula con el tipo de cambio mostrado y su fecha al generar la solicitud. La solicitud vence a los 7 días si no se confirma.

3. **Comprobante y confirmación.** Tras transferir, el cliente envía su comprobante por WhatsApp al número [POR COMPLETAR: número de WhatsApp], con su plan y su código de referencia. El plan se activa o renueva solo cuando Acontec confirma que el dinero fue acreditado en su cuenta. Acontec puede rechazar la solicitud si el monto o la referencia no coinciden, si el comprobante no es válido o si el pago no se acredita. Enviar un comprobante no garantiza la activación.

4. **Vigencia.** El periodo pagado comienza al vencer el periodo vigente, si aún tiene días pagados; si no, comienza al confirmarse el pago. No se prorratean periodos anteriores. Se conservan las garantías y excepciones de reembolso indicadas en la Política de Reembolsos y Cancelaciones.

5. **Vencimiento y suspensión.** Si el pago de un periodo no se confirma antes de su vencimiento y del periodo de gracia de [POR COMPLETAR: días de gracia] días, el acceso se suspende automáticamente. Los datos del cliente se conservan durante [POR COMPLETAR: plazo de conservación] días desde el bloqueo. El acceso se restablece al confirmarse el pago. Acontec también puede suspender o reactivar cuentas manualmente.

6. **Método asignado.** El método de pago queda asignado con el primer pago aprobado. Para cambiar de método, el cliente debe pedirlo a Acontec, que puede autorizarlo. Antes de pasar de Pagadito a transferencia deberán cancelarse los cobros recurrentes.

7. **Comisiones y errores.** Las comisiones del banco que envía la transferencia corren por cuenta del cliente. Si el monto es distinto al indicado o falta la referencia, Acontec contactará al cliente para resolverlo. Los pagos duplicados, erróneos o por montos mayores al debido se devuelven conforme a la Política de Reembolsos y Cancelaciones, o se aplican al siguiente periodo si el cliente lo prefiere. Un pago insuficiente requiere resolver la diferencia antes de su confirmación.

8. **Fraude.** El uso de comprobantes falsos o alterados puede causar el rechazo del pago, la suspensión de la cuenta y las acciones legales que correspondan.

## Adición a Privacidad: Datos del pago por transferencia

1. **Datos que tratamos.** Nombre, correo, plan, periodo, monto, moneda, banco, referencia y el comprobante enviado, que puede contener datos bancarios del cliente. Las disposiciones anteriores que describen los datos recibidos de Pagadito corresponden a ese canal; esta sección describe los datos adicionales del pago por transferencia.

2. **Finalidades.** Verificar y registrar el pago, activar el servicio, emitir recibos, llevar la contabilidad de Acontec y prevenir fraudes.

3. **WhatsApp.** El cliente envía el comprobante mediante WhatsApp al número [POR COMPLETAR: número de WhatsApp], un servicio de un tercero con sus propias políticas de privacidad. Recomendamos no incluir datos innecesarios, por ejemplo, ocultar números de cuenta o tarjeta que no sean el de la transferencia.

4. **Almacenamiento y acceso.** Los comprobantes y registros se guardan en almacenamiento privado, con acceso limitado a las personas autorizadas de Acontec. No se venden ni se comparten con terceros, salvo con los proveedores necesarios para operar el servicio —Netlify para el alojamiento y almacenamiento, y WhatsApp para el envío del comprobante— y por obligación legal. Estas excepciones conservan lo previsto sobre proveedores en la sección vigente de privacidad.

5. **Conservación.** Los comprobantes y registros de pago se conservan durante el tiempo exigido por obligaciones contables y legales, y luego se eliminan o anonimizan. Esta conservación legal de registros de pago es distinta del plazo de conservación de los datos de la cuenta tras su bloqueo, pendiente de definición para esta propuesta.

6. **Derechos.** El cliente puede solicitar acceso, corrección o eliminación de sus datos por jefryanderr@gmail.com, dentro de lo permitido por la ley. Este correo procede del documento público vigente; debe confirmarse antes de publicar.

## Adición a Reembolsos: Pagos por transferencia

1. **Medio y plazo.** Los reembolsos de pagos por transferencia se hacen por transferencia a la cuenta de origen, dentro de [POR COMPLETAR: plazo de devolución] días hábiles después de aprobada la solicitud. Las disposiciones anteriores sobre devolución a través de Pagadito aplican únicamente a pagos realizados por ese canal. El plazo vigente de respuesta a solicitudes no se sustituye por este plazo de ejecución de una devolución aprobada.

2. **Pagos duplicados, erróneos o excesivos.** Los pagos duplicados o erróneos se devuelven por completo; cuando el monto pagado supera el debido, se devuelve íntegramente el exceso. El importe a devolver puede aplicarse al siguiente periodo si el cliente lo prefiere. Se conserva la regla vigente de devolución íntegra de la diferencia por cobros de más.

3. **Periodos iniciados y garantías vigentes.** No se prorratean los periodos ya pagados. Se conserva para las transferencias la garantía vigente del primer pago, mensual o anual: el cliente puede solicitar el reembolso completo dentro de los primeros 7 días contados desde la fecha del pago; al aprobarse, se cierra el acceso. Las renovaciones no son reembolsables una vez iniciado el periodo, salvo error de Acontec o lo que exija la ley. En el plan anual, pasado el plazo de reembolso, el año pagado no se devuelve por meses no usados. Estas reglas mantienen las garantías y excepciones ya publicadas.

4. **Solicitud.** Las solicitudes de reembolso se envían a jefryanderr@gmail.com desde el correo de la cuenta, indicando el código de referencia, la fecha del pago y el motivo. También pueden enviarse por WhatsApp al número [POR COMPLETAR: número de WhatsApp]. Se conserva el plazo publicado de respuesta de un máximo de 5 días hábiles.

5. **Pagadito.** Los reembolsos de pagos hechos por Pagadito siguen las reglas ya publicadas de esa sección.

## Cookies

Sin cambios propuestos. Esta tarea no agregó cookies ni almacenamiento del navegador ni modificó el flujo de transferencia.

## Decisiones aplicadas y pendientes

El propietario confirmó conservar el reembolso del primer pago durante 7 días y la excepción por error de Acontec. Por ello, la prohibición inicialmente propuesta de reembolsar cualquier periodo iniciado se sustituyó en esta propuesta por las garantías vigentes. También autorizó delimitar las menciones anteriores de Pagadito a ese canal y conservar las excepciones de proveedores necesarios y obligaciones legales en privacidad.

La propuesta precisa que se devuelve el exceso cuando hay un pago mayor al debido; no promete devolver también el importe correcto del servicio. Así conserva la disposición vigente de devolver la diferencia íntegra. La aplicación a un periodo posterior requiere la preferencia del cliente.

Quedan cuatro datos por completar: número de WhatsApp, días de gracia, plazo de conservación y plazo de devolución aprobada. No se inventaron valores ni se equiparó el plazo de respuesta de 5 días hábiles al plazo de devolución. Los documentos vigentes indican 2 días de gracia y 90 días de conservación; los marcadores nuevos no modifican esos valores publicados. Antes de publicar, el propietario debe definir los plazos y conciliar cualquier diferencia con esas secciones mediante una aclaración aditiva expresa. Las cuentas de destino no se transcriben en la política: se muestran en la solicitud de pago conforme a la configuración bancaria.

## Requisito previo: tarea separada para el editor legal

El editor legal actual escribe borradores y publicaciones sobre el mismo registro activo. El guardado revisado registra versión y huella en eventos, pero no archiva allí los textos completos anteriores ni separa el borrador de la publicación. Antes de publicar cualquier política debe corregirse en una tarea separada para archivar versiones completas y mantener borradores independientes del documento vigente, con revisión y permisos administrativos. Esta tarea no modificó ese editor y no guardó ni publicó documentos.

La futura incorporación debe conservar el texto existente, los límites del servidor (80 caracteres de versión y 30.000 por documento), el escape de contenido y los enlaces al documento vigente. No se modifica la casilla de aceptación ni el flujo de Pagadito. Los cambios importantes requieren además respetar el aviso previo de al menos 30 días descrito en los Términos vigentes. La publicación requiere revisión y aprobación expresa del propietario; este archivo no la autoriza.

## Aceptación y comprobaciones pendientes

El mecanismo existente exige aceptar los documentos aprobados cuando la cuenta no tiene una aceptación coincidente con su versión y huella. Al publicar una nueva versión, las cuentas nuevas y las existentes sin esa aceptación reciben el requisito antes del acceso contable; las sesiones de colaboradores están exceptuadas en el servidor. Se registra la aceptación en Database. Esta descripción procede de revisión estática, no de una prueba funcional.

Tras desplegar la corrección técnica: abrir Panel y Centro de control con la cuenta autorizada, verificar ausencia de «t is not a function» y presencia del editor; revisar Mayor, Resultados, Balance y Traslados; verificar textos originales y personalizados y presentación móvil.

Tras la tarea separada del editor y la posterior aprobación de políticas: comprobar borradores sin alterar la versión pública, textos anteriores íntegros en el historial, versión nueva en páginas públicas y panel, enlaces y casilla de Pagadito sin cambios, aceptación con cuenta nueva y existente, permisos administrativos, revisión concurrente, escape y límites del servidor y lectura en móvil. Ninguna de estas comprobaciones funcionales se da por realizada en esta entrega.
