# Centro de control, suscripciones y Pagadito

## Puesta en marcha

La entrega mantuvo el frontend estático en `public/`, el acceso existente por correo o Google y la API con cookie HttpOnly. No se cambiaron las migraciones ya aplicadas ni se migró a otro proveedor de base de datos. La nueva migración es aditiva: conservó las fichas, pagos y eventos existentes y añadió las tablas comerciales. Los pagos históricos mantienen estado confirmado; no generan asientos retroactivos automáticamente.

Al acceder el propietario autorizado, su empresa Acontec se marca como empresa de plataforma si no existe ya otra marcada. Un índice único impide marcar dos. El rol real es `acontec_users.platform_admin`; ser dueño, tener una empresa llamada Acontec o enviar un identificador desde el navegador no concede el rol. El Centro de control y la Administración de clientes requieren además que la empresa marcada sea la activa en la sesión del servidor. Los colaboradores no acceden a esos endpoints. La contabilidad habitual y el nombre de la empresa permanecen en su panel.

En Netlify, configura `PAGADITO_UID`, `PAGADITO_WSK` y `PAGADITO_ENV`, con alcance para Functions y los contextos correspondientes. Usa primero las credenciales del comercio de pruebas y el modo `sandbox`. Si faltan variables, el checkout devuelve 503; nunca se inventan credenciales ni se selecciona producción por un error de escritura. El Centro de control solo muestra entorno y disponibilidad. No tiene campos que expongan secretos.

El cambio posterior se realiza en esas mismas variables: sustituye las dos credenciales por las del comercio real, selecciona el modo `production` y redespliega. Antes de cambiar, cancela y concilia las autorizaciones pendientes del entorno anterior. Cada autorización conserva su entorno y no puede consultarse o cancelarse con las credenciales del otro. Los pagos de sandbox conservan su historial, pero no activan una suscripción en producción ni se contabilizan como ingresos reales. Los pagos manuales nuevos también quedan identificados como pruebas cuando el entorno es sandbox.

Las variables opcionales `PAGADITO_MONTHS`, `PAGADITO_YEARS` y `PAGADITO_GRACE_DAYS` controlan los cobros y la gracia. Se programan por defecto 12 mensualidades o 3 anualidades, incluyendo el primer cobro de hoy. El resumen presenta el número y el importe antes de aceptar. Los cambios de precio de planes no alteran los cobros ya autorizados. Una autorización ambigua por pérdida de respuesta bloquea otro intento hasta conciliarla con Pagadito; no se repite a ciegas un posible cobro.

## Planes y módulos

| Plan | Mensual USD | Anual USD | Límites iniciales |
|---|---:|---:|---|
| Básico | 35 | 314 | Una empresa y la sucursal principal |
| Estándar | 70 | 630 | Una empresa y la sucursal principal |
| Pro | 200 | 1,900 | Sin límite del plan de empresas o sucursales |

El precio anual se cobra completo hoy y cubre 12 meses. Se muestra el ahorro frente a 12 pagos mensuales, sin afirmar que equivale a un mes gratis. Se conservan las empresas existentes que exceden los límites; las excedentes, ordenadas por identificador estable, quedan de consulta. El administrador puede ajustar límites y activar o desactivar los planes.

Mapa de módulos reales:

| Concepto solicitado | Rutas y permisos existentes |
|---|---|
| Personal | `personal`, `nomina`, `liquidaciones`, `provisiones`; permiso `personal` |
| Fiscal | `fiscal`, `impuestos`, `propiedades`, `reglas`; permiso `fiscal` |
| Control del personal | `asistencia`; permiso `personal` |
| Decisiones del negocio | `simuladores`, `rentabilidad`, `pronostico`; datos propios de finanzas |
| Sucursales | `sucursales` y operación de servidor `branch` |
| Ventas y facturación | `ventas`, `clientes`, `facturacion` y operaciones correspondientes |
| Otros | Compras, gastos, inventario, contabilidad, finanzas, cajas, costos, proveedores y controles existentes |

El Básico excluye los cuatro conceptos solicitados y la administración de sucursales; Estándar excluye sucursales; Pro incluye todo. Los módulos excluidos aparecen con candado. Se mantienen los permisos de colaboradores y el filtro de sucursal. Los cálculos de Decisiones se ejecutan en el navegador sobre información que el usuario ya tiene derecho a consultar; no son un endpoint adicional de datos privados. No se agregó un asistente de IA: su contador aparece como no disponible.

La prueba única por correo empieza al inicializar la suscripción en el primer acceso a los datos o a Mi suscripción. Dura 24 horas. El dueño puede contratar un plan durante la prueba, sin esperar a su vencimiento, desde el aviso del panel o «Mi suscripción y pagos». El primer cobro se programa para hoy; al confirmarse, el plan elegido y su periodo pagado sustituyen el acceso de prueba. Iniciar el pago sin confirmación conserva la prueba vigente. Las cuentas existentes reciben esa prueba sin borrar su ficha ni una vigencia manual ya registrada. Los administradores de plataforma conservan acceso completo. El servidor comprueba el plan del dueño de la empresa también cuando entra un colaborador. La interfaz consulta la vigencia cada cuatro minutos y al volver a la pestaña. La gracia vence a las 23:59:59 de Managua del segundo día posterior al fin del periodo. Cancelar renovaciones conserva solo el periodo pagado, sin extenderlo mediante gracia.

## Clientes, pagos, correo y contabilidad

Las fichas, notas y el historial siguen usando Administración de clientes. El Centro de control añade suscripciones, límites, contactos por país, uso agregado, vencimientos, pagos por verificar, alertas y gráficos. El uso de almacenamiento muestra el tamaño de los documentos en Database; no representa el total de copias históricas, índices o archivos de Blobs. La tasa mostrada es bajas del mes / clientes actuales, una aproximación explícita, no una reconstrucción histórica de clientes activos al inicio del mes.

Las vistas se acotan a 5,000 clientes y 10,000 pagos e indican si se truncaron. Las métricas derivadas de esas vistas también quedan sujetas a ese límite. El pendiente incluye pagos manuales por verificar y cargos programados ya vencidos del entorno activo. Los periodos usan calendario de Managua; los pagos pendientes antiguos permanecen visibles en la cola. Los CSV y la impresión a PDF agrupan por mes, plan, método, moneda, estado y entorno. Nunca se suman monedas distintas ni ingresos ficticios con reales.

Cada mutación administrativa exige confirmación y motivo. Los pagos manuales quedan por verificar. Aprobar actualiza la vigencia y crea el recibo en la cola. La baja intenta cancelar los cobros futuros en Pagadito y conserva acceso hasta la fecha pagada; suspender solo bloquea el acceso. El webhook verifica firma RSA y certificado de dominio permitido, rechaza redirecciones y consulta al proveedor antes de confiar en un estado de pago. La clave única por entorno y referencia evita repetir pagos cuando coinciden webhook, retorno y respaldo diario. La vigencia recurrente solo cubre el prefijo consecutivo de cobros completados. Un aviso tardío del esquema anterior no reemplaza el nuevo plan.

Los comprobantes privados PDF, JPG, PNG o WebP se guardan en Netlify Blobs y sus metadatos en Database. Se permite un archivo de hasta 1 MB por pago, hasta 100 archivos o 50 MB por cliente. La descarga exige sesión de super administrador y empresa de plataforma activa; no se publica la clave de almacenamiento como enlace estático.

El envío de correo requiere configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` en Functions. No se eligió ni contrató un proveedor por cuenta del propietario. Si faltan, los mensajes permanecen en cola. Se editan y guardan plantillas de anuncio y recordatorio, con las variables `{{nombre}}`, `{{correo}}` y `{{pagadoHasta}}`. Los envíos directos se procesan después de la respuesta mediante `waitUntil`; el respaldo diario reintenta un lote de hasta cinco mensajes. Se permiten hasta cinco intentos; una entrega cuyo proceso se interrumpa tras marcarla `sending` requiere conciliación administrativa para evitar un reenvío incierto. No se afirma entrega al buzón por haber creado una fila en la cola. El remitente debe estar autorizado por el proveedor SMTP y sus registros DNS.

El asiento automático es optativo. Antes de habilitarlo, Acontec debe tener moneda base USD y cuentas válidas de ingreso y activo para el cobro. Cada pago confirmado real usa un identificador de asiento derivado de su pago y actualiza JSON, revisión, respaldo, auditoría y almacenamiento relacional dentro de la transacción. No se convierte moneda implícitamente ni se escribe en periodos cerrados. Un error contable deja la confirmación pendiente para reintentar tras corregir la configuración; no se afirma que el proveedor no haya cobrado. Los históricos se contabilizan solo mediante la acción explícita, con su referencia estable.

El respaldo de Pagadito consulta diariamente hasta diez autorizaciones, priorizando las menos recientemente consultadas. No reemplaza los webhooks; en instalaciones grandes requiere ampliar el procesamiento. No se consulta al proveedor en cada lectura contable. La revisión manual desde Mi suscripción permite reintentar la confirmación.

## Soporte y privacidad

El dueño concede o revoca desde «Permiso temporal de soporte» un acceso de 24 horas a un super administrador. Una pertenencia ordinaria de ese administrador a una empresa ajena no sustituye este permiso. Cada petición vuelve a comprobar la vigencia; todas sus escrituras quedan prohibidas, incluyendo operaciones, restauraciones y guardados directos. Se muestra el aviso de soporte y se registra cada consulta en la bitácora de la empresa. Al expirar o revocarse, la siguiente petición rechaza el acceso; la interfaz lo revisa al volver a la pestaña y cada cuatro minutos. La información ya consultada no puede retirarse de la memoria del usuario.

## Legal

Las rutas `/terminos`, `/privacidad` y `/reembolsos` son públicas. Se incorporaron las plantillas del documento adjunto y se dejaron vacíos los datos no confirmados del titular. El titular debe completar responsable, RUC si aplica, domicilio y revisar sus compromisos de devolución y conservación. No se implementó eliminación automática de datos a los 90 días: la política debe revisarse y ajustarse a la operativa antes de aprobarla. No se inventaron datos fiscales.

La administración permite revisar y aprobar los tres textos con una versión nueva. Una versión ya aceptada no puede cambiar. Los documentos que antes no tenían reembolsos requieren una nueva aprobación. El checkout exige aceptación explícita y conserva versión, fecha, IP proporcionada por Netlify y huella de los textos. Las páginas vuelven a consultar la versión publicada. Las claves y los datos de tarjeta se quedan fuera de la interfaz y del historial.

## Guía de pruebas sin cobros reales

1. Configura las credenciales del comercio de pruebas y confirma que el Centro de control indica sandbox. La última comprobación de esta sesión no encontró las tres variables de Pagadito; no se realizó ningún pago.
2. En ese comercio registra el retorno `https://acontec.company/?pago=retorno` y el webhook `https://acontec.company/api/pagadito-webhook`. Para una vista previa usa su propio dominio y registra sus URL si el comercio lo permite.
3. Completa y aprueba una versión de los tres documentos desde Administración de clientes. Configura SMTP si quieres comprobar recibos reales de correo.
4. Entra con otro correo y comprueba la cuenta regresiva de 24 horas. Sin esperar al vencimiento, usa «Elegir plan y pagar» desde el panel. Elige Mensual, revisa precio y cobros programados y acepta las políticas. El botón permanece deshabilitado hasta aceptar.
5. Antes de pagar, la dirección de Pagadito debe contener el host exacto `sandbox-connect.pagadito.com`. Si no aparece sandbox, cierra la página. Usa exclusivamente los datos de tarjeta ficticia indicados por Pagadito y por el documento adjunto, nunca una tarjeta real.
6. Al volver, usa «Verificar mi pago». Comprueba el pago único en el Centro de control, su marca SANDBOX, el plan y la fecha de vigencia. Confirma que el acceso cambia de prueba al plan elegido de inmediato y que el aviso de prueba desaparece. No debe aparecer un ingreso ficticio en la contabilidad de Acontec.
7. Repite con otro correo y Anual: Básico 314, Estándar 630 o Pro 1,900 USD; primer cobro hoy y siguientes a 12 y 24 meses. Comprueba el ahorro mostrado frente a las mensualidades.
8. Cambia mensual/anual y comprueba en el comercio que se cancelaron los cargos pendientes del esquema anterior. Cancela cobros y confirma que la vigencia pagada permanece.
9. Para simular vencimiento, usa el ajuste normal de Suscripción en el Centro de control, con motivo de prueba: selecciona estado activo, una fecha «pagado hasta» anterior y una prueba ya terminada. Un día vencido permite gracia; más de dos días completos bloquea el servidor con 402. Usa fechas de Managua. No edites Blobs: las suscripciones están en Database y no hay un endpoint temporal que eliminar.
10. Antes de producción concilia y cancela las autorizaciones sandbox, cambia las tres variables en Netlify, registra retorno/webhook y políticas en el comercio real y redespliega. Los permisos de sandbox no sirven como pago real. Después realiza una verificación real autorizada por el propietario y revisa su recibo y asiento.

## Verificaciones pendientes después del despliegue

No se ejecutaron compilaciones, servidores ni pruebas locales. Solo se revisó estáticamente el código y su sintaxis. Las pruebas preparadas no se consideran aprobadas por ello.

- Aplicación de la migración aditiva, rol real de Functions y RLS en las tablas nuevas; ausencia de cambios en las once migraciones previas.
- Ejecutar las pruebas de reglas y, contra una vista previa, las de HTTP con `ACONTEC_TEST_URL`. Las de HTTP se omiten cuando falta esa URL.
- Usuario sin rol y colaborador de Acontec: 403 en plataforma, administración y comprobantes; visitante sin sesión: 401. Super administrador en una empresa normal: 403. Repetir tras cambiar entre empresas y entre pestañas.
- Prueba inicial única, bloqueo con la aplicación abierta, regreso a pestaña, gracia de Managua, colaborador cuyo dueño venció, módulos excluidos y excesos de empresas/sucursales.
- Confirmación sandbox mensual/anual con las respuestas reales de la API de Pagadito; certificado y nombres de cabeceras reales, firma incorrecta 401, notificaciones repetidas, tardías y fuera de orden; reintentos del proveedor.
- Conciliación de una autorización con respuesta perdida y cancelación de cargos pendientes antes del cambio de entorno. Verificar que Pagadito tenga habilitada la modalidad recurrente del comercio.
- En un entorno aislado con un pago real o manual identificado como real: confirmar simultáneamente por dos solicitudes y comprobar un solo pago y un solo asiento; probar configuración contable inválida, moneda incompatible, periodo cerrado y reintento.
- Conceder soporte, verificar lectura y aviso, rechazar todos los métodos de escritura y repetir después de revocar y después de las 24 horas. Verificar que cada consulta figure en la bitácora.
- Carga/descarga privada de comprobantes, rechazo de formatos y tamaños inválidos, aislamiento por sesión y límites de archivos.
- Entrega SMTP real de recibos y mensajes segmentados, sustitución de variables y revisión de mensajes pendientes o interrumpidos. Un correo en cola no confirma entrega.
- Publicación legal y aceptación de nueva versión, enlaces sin sesión, móvil y modo oscuro; exportaciones con distintas monedas y valores que podrían interpretarse como fórmulas CSV.

## Reversión conservando los datos

Para retirar esta funcionalidad, restaura el código de la versión anterior y conserva todas las tablas, columnas, migraciones y registros añadidos. No deshagas SQL ni borres suscripciones, pagos, comprobantes, asientos o auditorías. Desactivar el checkout o volver al código anterior no cancela cobros en Pagadito: cancela primero las autorizaciones del comercio correspondiente. Antes de volver a activar el módulo concilia pagos y conserva las revisiones vigentes. Los asientos ya contabilizados se corrigen mediante asientos inversos, no mediante borrado.

## Publicación autorizada para habilitar pagos

La actualización de datos `20261022223000_publish_approved_payment_policies.sql` preparó la publicación de la versión `2026-10-22-pagos-1` a partir del borrador inicial, por autorización del propietario. No incorporó su nombre ni domicilio. Eliminó los espacios vacíos de identificación y conservó el correo de contacto que ya era público. No cambió precios, periodos, política de reembolso ni aceptación explícita del cliente.

La actualización se aplica durante el despliegue, con bloqueo de la fila, incremento de revisión y evento de auditoría con la huella contractual. Conserva documentos ya aprobados. Si encuentra un borrador diferente o aceptaciones de las versiones involucradas, detiene la publicación para impedir sobrescrituras. No modifica el esquema ni migraciones anteriores y no elimina datos.

La presencia de variables de Pagadito no acredita una conexión con el comercio. Se solicitó guardar el entorno de prueba en la configuración de producción; la CLI informó éxito, pero la lectura posterior no permitió confirmar el valor efectivo. Tras desplegar, comprobar el entorno en el Centro de control, la versión legal aprobada y un checkout con cuenta de cliente. No se confirmó ningún pago durante esta revisión.
