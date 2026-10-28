# Centro de control, suscripciones y Pagadito

## Puesta en marcha

La entrega mantuvo el frontend estático en `public/`, el acceso existente por correo o Google y la API con cookie HttpOnly. No se cambiaron las migraciones ya aplicadas ni se migró a otro proveedor de base de datos. La nueva migración es aditiva: conservó las fichas, pagos y eventos existentes y añadió las tablas comerciales. Los pagos históricos mantienen estado confirmado; no generan asientos retroactivos automáticamente.

Al acceder el propietario autorizado, su empresa Acontec se marca como empresa de plataforma si no existe ya otra marcada. Un índice único impide marcar dos. El rol real es `acontec_users.platform_admin`; ser dueño, tener una empresa llamada Acontec o enviar un identificador desde el navegador no concede el rol. El Centro de control y la Administración de clientes requieren además que la empresa marcada sea la activa en la sesión del servidor. Los colaboradores no acceden a esos endpoints. La contabilidad habitual y el nombre de la empresa permanecen en su panel.

En Netlify, configura `PAGADITO_UID`, `PAGADITO_WSK` y `PAGADITO_ENV`, con alcance para Functions y los contextos correspondientes. Usa primero las credenciales del comercio de pruebas y el modo `sandbox`. Si faltan variables, el checkout devuelve 503; nunca se inventan credenciales ni se selecciona producción por un error de escritura. El Centro de control solo muestra entorno y disponibilidad. No tiene campos que expongan secretos.

El cambio posterior se realiza en esas mismas variables: sustituye las dos credenciales por las del comercio real, selecciona el modo `production` y redespliega. Antes de cambiar, cancela y concilia las autorizaciones pendientes del entorno anterior. Cada autorización conserva su entorno y no puede consultarse o cancelarse con las credenciales del otro. Los pagos de sandbox conservan su historial, pero no activan una suscripción en producción ni se contabilizan como ingresos reales. Los pagos manuales nuevos también quedan identificados como pruebas cuando el entorno es sandbox.

### Configuración exacta para un pago de prueba

En Site configuration → Environment variables, configura estas tres variables con alcance **Functions**:

| Nombre | Valor |
|---|---|
| `PAGADITO_ENV` | `sandbox` |
| `PAGADITO_UID` | UID del comercio sandbox proporcionado por Pagadito |
| `PAGADITO_WSK` | WSK del mismo comercio sandbox proporcionado por Pagadito |

Las credenciales son privadas: cópialas directamente del comercio a Netlify. No se incluyen en el código ni se muestran en la web. Builds y Runtime no son necesarios para estas Functions; Runtime corresponde a otras funciones de la plataforma, como formularios y solicitudes firmadas. Aplica las variables al contexto Production si pruebas en acontec.company; el contexto de despliegue Production es independiente del modo sandbox del proveedor. Para una vista previa, configura también Deploy Previews.

La lectura está centralizada en `netlify/lib/billing-rules.mjs`, mediante `process.env.PAGADITO_ENV`, `process.env.PAGADITO_UID` y `process.env.PAGADITO_WSK`, exclusivamente en el servidor, sin prioridad de `Netlify.env.get` ni valores de entorno por defecto. `providerConfig()` aplica `trim().toLowerCase()` a `PAGADITO_ENV`. Solo acepta `sandbox` y `production`; `test` y `live` no son alias válidos. Un valor ausente o en blanco mantiene el proveedor sin disponibilidad y nunca habilita pagos reales. Un valor inválido devuelve un error 503 que identifica la variable y enumera las opciones válidas sin mostrar el valor recibido. UID y WSK se leen también directamente de `process.env`, se recortan con `trim()` y conservan mayúsculas y minúsculas tanto en autenticación como en verificación de firmas. Un entorno ausente devuelve disponibilidad falsa, entorno vacío y ninguna URL de proveedor. El checkout ya presenta ese error como texto.

Después de guardar las variables, realiza un nuevo despliegue para que las Functions reciban los cambios. Puedes usar **Clear cache and deploy site**, aunque limpiar la caché no es necesario para actualizar estas variables: basta un nuevo deploy. Tras el despliegue, confirma «Modo de pruebas: dinero ficticio» en el checkout y el dominio `sandbox.pagadito.com` al continuar. El botón también exige disponibilidad del proveedor, documentos legales publicados y aceptación explícita. Esta revisión estática no acredita una conexión ni un pago confirmado con Pagadito.

Las variables opcionales `PAGADITO_MONTHS`, `PAGADITO_YEARS` y `PAGADITO_GRACE_DAYS` controlan los cobros y la gracia. Se programan por defecto 12 mensualidades o 3 anualidades, incluyendo el primer cobro de hoy. El resumen presenta el número y el importe antes de aceptar. Los cambios de precio de planes no alteran los cobros ya autorizados. Una autorización ambigua por pérdida de respuesta bloquea otro intento hasta conciliarla con Pagadito; no se repite a ciegas un posible cobro.

## Planes y módulos

| Plan | Mensual USD | Anual USD | Límites iniciales |
|---|---:|---:|---|
| Facturación | 30 | 310 | Una empresa y la sucursal principal |
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
| Sucursales | `sucursales`, `traslados`, `compararsucursales`; operaciones `branch`, `stockTransfer`, `stockReceive`, `moneyTransfer` |
| Ventas y facturación | `ventas`, `clientes`, `facturacion` y operaciones correspondientes |
| Contabilidad formal | Apertura, diario, mayor, cuentas, períodos, activos, préstamos, divisas, plantillas, antigüedad, cheques/letras y socios |
| Excepción operativa | `cobrar` usa Ventas; `pagar` usa Compras. Los abonos validan la factura de crédito, fecha, dos contrapartidas, importe y deuda pendiente; no conceden asientos manuales ni saldos iniciales |
| Tesorería | `caja`, `cajachica`, `reportescaja`; no incluye los turnos de Facturación |
| Otros | Compras, gastos, inventario, costos, proveedores, Accesibilidad, ajustes y auditoría |

Facturación incluye ventas y clientes, compras y devoluciones, proveedores, gastos, costos, inventario e importación, facturación con IVA, notas de crédito, documentos, apertura y cierre de turnos, cuentas por cobrar y pagar, Fiscal, Accesibilidad, ajustes y auditoría. Excluye contabilidad formal, estados financieros, Tesorería, Personal, Control del personal, Decisiones y Sucursales (incluidos traslados y comparación). Básico incluye Fiscal y conserva las exclusiones de Personal, Control del personal, Decisiones y Sucursales. Estándar excluye sucursales; Pro incluye todo. Los módulos excluidos se ocultan del menú y del panel; las rutas y operaciones también se comprueban en el servidor. Se mantienen los permisos de colaboradores y el filtro de sucursal. Los cálculos de Decisiones se ejecutan en el navegador sobre información que el usuario ya tiene derecho a consultar; no son un endpoint adicional de datos privados. No se agregó un asistente de IA: su contador aparece como no disponible.

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
2. En ese comercio registra el retorno `https://acontec.company/?token={value}&ern={ern_value}` y el webhook `https://acontec.company/api/pagadito-webhook`. Para una vista previa usa su propio dominio y registra sus URL si el comercio lo permite.
3. Completa y aprueba una versión de los tres documentos desde Administración de clientes. Configura SMTP si quieres comprobar recibos reales de correo.
4. Entra con otro correo y comprueba la cuenta regresiva de 24 horas. Sin esperar al vencimiento, usa «Elegir plan y pagar» desde el panel. Elige Mensual, revisa precio y cobros programados y acepta las políticas. El botón permanece deshabilitado hasta aceptar.
5. Antes de pagar, la dirección de Pagadito debe contener el host exacto `sandbox.pagadito.com`. Si no aparece sandbox, cierra la página. Usa exclusivamente los datos de tarjeta ficticia indicados por Pagadito y por el documento adjunto, nunca una tarjeta real.
6. Al volver, usa «Verificar mi pago». Comprueba el pago único en el Centro de control, su marca SANDBOX, el plan y la fecha de vigencia. Confirma que el acceso cambia de prueba al plan elegido de inmediato y que el aviso de prueba desaparece. No debe aparecer un ingreso ficticio en la contabilidad de Acontec.
7. Repite con otro correo y Anual: Facturación 310, Básico 314, Estándar 630 o Pro 1,900 USD; primer cobro hoy y siguientes a 12 y 24 meses. Comprueba el ahorro mostrado frente a las mensualidades.
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


## Conciliación automática y expiración de intentos

El retorno `?pago=retorno` solicita la confirmación al servidor antes de cargar la empresa, incluso si el acceso anterior venció. El servidor consulta Pagadito; el navegador no aporta estados, importes ni referencias que concedan vigencia. Solo los cargos `COMPLETED` de la respuesta del proveedor conceden cobertura, con las validaciones de referencia, importe y entorno existentes. El fallo del primer cargo termina el intento aunque existan cuotas futuras pendientes.

La función `resolve-payments` procesa hasta 50 intentos por minuto en producción. Consulta primero los que conservan token y expira los intentos de más de 15 minutos. Al crear otro checkout, concilia el anterior: si ya fue pagado devuelve su activación; en caso contrario lo abandona y permite el nuevo intento. Mantiene bloqueo por usuario para solicitudes simultáneas y una espera breve mientras otra solicitud está creando el enlace. Intenta cancelar los cargos pendientes cuyos tokens conoce. La cancelación no confirmada se registra sin afirmar que el proveedor haya cancelado.

Las consultas de estado tienen un reintento por timeout. Crear una autorización y cancelar cargos no se reintenta a ciegas. Los logs incluyen operación, estado HTTP y código PG, sin cuerpos de respuesta, credenciales ni tokens. Expirar o abandonar un intento es un estado local, no prueba de que Pagadito haya revocado la autorización. Los tokens e históricos se conservan; el webhook y el respaldo diario siguen conciliando confirmaciones tardías, con claves de pago idempotentes y sin reemplazar un plan posterior ya activado.

Una respuesta perdida al crear una autorización puede dejar el intento sin token. La API integrada necesita ese token para consultar; no se inventa una confirmación ni se afirma una cancelación. Estos intentos expiran automáticamente y no bloquean nuevos pagos. Para garantizar la revocación de una autorización sin token se necesita un mecanismo de búsqueda por referencia respaldado por Pagadito.

La sesión de implementación solo pudo consultar la rama de vista previa, que no contenía autorizaciones. No se modificaron pagos de producción ni se verificaron las dos autorizaciones reportadas. El despliegue y las pruebas de integración, incluidos retorno, timeout, rechazo, concurrencia y confirmación tardía, quedan sujetos a la validación de la plataforma. No se ejecutaron pruebas, servidores ni compilaciones locales.


## Parámetros del retorno de Pagadito

La URL exacta para configurar en el sandbox es `https://acontec.company/?token={value}&ern={ern_value}`. `token` recibe el token de Pagadito y `ern` recibe el número de comprobante o referencia ERN del comercio. Las llaves se conservan en la configuración para que Pagadito sustituya los valores.

El navegador lee ambos parámetros, los retira de la barra de direcciones y los envía por POST JSON a `/api/billing/confirm` después de iniciar sesión. El servidor valida el formato y busca el ERN únicamente entre los intentos del usuario autenticado. El token recibido no concede permisos ni confirma un pago: se consulta `get-status-recurring-payments` con el token de autorización guardado en Database y el entorno del intento. La conciliación contrasta los ERN y los importes y moneda disponibles en la respuesta; solo los cargos `COMPLETED` activan cobertura. El retorno antiguo `?pago=retorno` y la verificación manual siguen conciliando el último intento.

Esta revisión fue estática; quedó pendiente comprobar el retorno completo y la respuesta real de la API con un pago sandbox tras el despliegue. No se ejecutaron pruebas, servidores ni compilaciones locales.


## Suscripción de colaboradores por empresa activa

El acceso del colaborador, tanto por usuario como por correo, depende exclusivamente del plan del dueño de la empresa seleccionada. Consultar su plan no inicializa una suscripción ni una prueba personal del colaborador. Si también es dueño de otra empresa, su suscripción propia solo corresponde a sus empresas; no reemplaza el plan de la empresa donde colabora.

La vista «Plan de la empresa» no ofrece contratación, confirmación ni cancelación de cobros a colaboradores o soporte. Esas operaciones requieren ser dueño de la empresa activa en la sesión del servidor; un nombre de rol administrativo de colaborador no concede permisos de pago. Cuando falta renovación, se muestra «El plan de la empresa está pendiente de renovación. Avisa al dueño o administrador.». Se conserva la selección de una empresa vencida para evitar gestionar accidentalmente la suscripción de la empresa anterior.

Verificaciones pendientes después del despliegue: acceso por usuario y por correo a una empresa con plan vigente; vencimiento del dueño sin opciones de pago del colaborador; rechazo 403 de checkout, confirmación y cancelación con ambas clases de colaborador; alternancia entre una empresa propia y otra compartida con vigencias diferentes; contratación y retorno de pago del dueño durante prueba y tras vencimiento. Confirmar que las consultas de colaboradores sin empresas propias no crean suscripciones personales. Esta revisión fue estática y no ejecutó pruebas, servidores ni compilaciones locales, ni modificó datos existentes.

## Contenido y políticas

En la empresa de plataforma, el administrador dispone de «Contenido y políticas». Reúne la edición versionada de términos, privacidad, reembolsos y cookies, así como el editor de apariencia y textos globales. Los documentos aprobados se consultan desde los enlaces públicos y el panel; las cookies publicadas también se incluyen en la aceptación al ingresar. Los documentos históricos sin un campo de cookies conservan su huella original. Al añadir o cambiar cookies hay que publicar una versión nueva, igual que para los demás documentos.

Se retiró la referencia técnica al almacenamiento de la política informativa interna. Los enlaces del panel a términos, privacidad y reembolsos consultan ahora el documento contractual vigente, evitando mantener textos distintos. La información sobre devoluciones de productos de los comercios conserva su finalidad separada y tiene su propio editor.

El editor de página permite cambiar los nombres de los módulos del menú lateral y móvil, título y descripción del panel y aviso de cookies, además de la marca, contactos, imágenes y colores existentes. Los nombres no cambian identificadores, permisos ni operaciones. El nombre de la empresa sigue encabezando el panel. Los textos admiten únicamente contenido escapado, con límites en el servidor y revisión optimista.

Estos campos se guardan en el contenido global existente: no requieren tablas ni migraciones. La configuración ya descargada al abrir la página contiene los textos; no se añadieron sondeos ni guardados automáticos. El módulo de contenido no descarga fichas, pagos ni métricas de clientes. Cada consulta legal verifica la versión vigente; no se almacena una copia contractual en el navegador.

Se comprobó la sintaxis y se actualizaron las huellas de recursos. No se ejecutaron pruebas, servidores ni compilaciones locales. Después del despliegue queda verificar la publicación de una versión nueva con cookies, su aceptación con una cuenta nueva, coincidencia entre páginas públicas y panel, edición desde dos pestañas, rechazo de permisos ajenos a plataforma y visualización móvil de los nombres personalizados. No se midió una reducción de créditos; depende del uso real.

## Configuración efectiva de módulos

El editor de planes muestra todos los módulos con casillas **Incluir**. Una casilla marcada habilita el módulo; una desmarcada lo guarda en las exclusiones. Las exclusiones se aplican al dueño y a sus colaboradores, además de los permisos individuales. Habilitar un módulo no amplía automáticamente los límites de empresas o sucursales. Los cambios se consultan al volver a la pestaña y cada cuatro minutos; con cambios locales pendientes se exige resolver el guardado antes de recargar datos. Las tarjetas describen la configuración guardada en lugar de asumir prestaciones por nombre de plan.

Los precios confirmados iniciales de Facturación son 3,000 y 31,000 centavos USD; el ahorro anual inicial es US$50. Son editables. La inicialización inserta únicamente planes ausentes. Una política identificada en el contenido de configuración retira Fiscal de las exclusiones existentes de Básico una sola vez e incrementa su revisión; conserva los precios, límites y demás exclusiones. Las ediciones posteriores de módulos siguen siendo respetadas. No requiere cambios de esquema ni migraciones y no altera contratos recurrentes ya autorizados.

La respuesta contable conserva el catálogo de cuentas necesario para las operaciones permitidas, sin entregar los asientos de módulos excluidos. Los asientos automáticos se generan en el servidor y se conservan completos en el almacenamiento. Los movimientos de inventario necesarios para Kardex se proyectan sin datos contables ocultos. Las bases anuales de Fiscal se entregan como totales en centavos, incluyendo el historial anterior al cambio de plan sin exponer nóminas ni asientos bloqueados. Los respaldos completos continúan exigiendo acceso completo; la auditoría disponible para planes restringidos omite el detalle de cambios que podría contener registros excluidos. La prueba gratuita continúa usando Pro.

## Impresión compartida

Reportes, facturas, boletas de nómina, constancias/documentos y cobros del servicio usan el mismo diálogo de color, papel y orientación. Las preferencias solo viven en memoria. A4 y Carta admiten horizontal; el papel de 80 mm siempre es vertical. Los reportes de más de cinco columnas muestran una recomendación al seleccionar 80 mm. La factura conserva sus márgenes y diseños existentes. Las clases de color y papel y la regla temporal de página se eliminan al terminar o cancelar el diálogo nativo y si la impresión falla. Los estilos de impresión se agrupan en un solo bloque; no modifican las tablas de exportación ni los generadores jsPDF.

Se retiraron las menciones promocionales del procesador en las pantallas de contratación y el pie público. Se conservaron las referencias legales, técnicas y de administración necesarias para operar y conciliar pagos.

## Validación pendiente después del despliegue

La revisión de esta entrega fue estática; no se ejecutaron pruebas, servidores, compilaciones, pagos ni verificaciones visuales locales.

1. Con una cuenta de prueba en Facturación, comprobar menú lateral, barra inferior y panel; intentar navegar directamente a Diario, Mayor, Estados financieros, Tesorería, Personal, Decisiones y Traslados. Confirmar rechazo también al solicitar sus operaciones a la API.
2. En Fiscal → Reglas de cada empresa, configurar IVA; crear productos con IVA y facturar. Crear cajero y vendedor en Accesibilidad y entrar con ambos; verificar sus permisos y turnos.
3. Facturar a crédito, cobrar un abono, registrar compra y gasto, pagar a proveedor, consultar libros de ventas/compras/IVA, cerrar caja y exportar Excel. Comprobar que un abono excesivo o ajeno queda rechazado.
4. En Centro de control, marcar y desmarcar Incluir para un módulo en Facturación y Básico; recargar y comprobar interfaz, datos y API. Verificar Fiscal en una suscripción Básico anterior y en una compra nueva. Probar cambio de plan, precios editados, ahorro y vigencia en el entorno de pruebas, conservando la prueba Pro.
5. Con un plan que permita Mayor (o habilitándolo temporalmente), imprimir Mayor, Kardex y Libros fiscales en blanco y negro y a color. Probar A4 vertical/horizontal, Carta y 80 mm; revisar papel y advertencia solo en 80 mm, repetir encabezados, bordes y legibilidad.
6. Imprimir nómina y factura, incluida térmica; cancelar la impresión y comprobar que la pantalla conserva su aspecto. Exportar Excel, CSV y PDF de jsPDF para comparar con el comportamiento anterior.

## Archivos de esta entrega

- `docs/centro-control-pagadito.md`
- `netlify/functions/api.mjs`
- `netlify/lib/access.mjs`
- `netlify/lib/advanced.mjs`
- `netlify/lib/billing-rules.mjs`
- `netlify/lib/billing.mjs`
- `netlify/lib/customer-admin.mjs`
- `netlify/lib/legal-templates.mjs`
- `netlify/lib/operations.mjs`
- `netlify/lib/transfers.mjs`
- `public/accounting.js`
- `public/administration.js`
- `public/advanced.js`
- `public/app.js`
- `public/billing.js`
- `public/configurar-google.html`
- `public/cookies.html`
- `public/country.js`
- `public/experience.js`
- `public/index.html`
- `public/legal.css`
- `public/legal.js`
- `public/operations.js`
- `public/platform.js`
- `public/privacidad.html`
- `public/reembolsos.html`
- `public/style.css`
- `public/terminos.html`
- `public/trade.js`
- `tests/billing-rules.test.mjs`
- `.netlify/`
- `netlify/lib/fiscal-projection.mjs`
- `public/printing.js`


## Empresas de prueba de plan

Al cargar sus empresas, el super administrador obtiene una única «Empresa de prueba de plan» con Pro inicial, creada automáticamente bajo bloqueo e identidad estable; desde Mi suscripción puede probar los cuatro planes o volver a Pro con confirmación breve, revisión y auditoría, conservando datos y empresas de prueba anteriores y sin operaciones comerciales (pendiente verificar tras el despliegue).

El Centro de control incluye empresas propias de prueba interna sin cobro. Desde Acontec activa en la sesión, el super administrador puede crear «Prueba · <nombre del plan>» (con número si se repite), abrirla con el selector existente, cambiar su plan mediante selector y motivo confirmado, o quitar la prueba. No se crea una empresa automáticamente al desplegar. La interfaz normal muestra una franja permanente «MODO DE PRUEBA INTERNA · Plan <nombre> · sin cobro» y la insignia del selector; Mi suscripción explica el modo sin ofrecer contratación. La matriz utiliza los módulos y límites actuales guardados de los cuatro planes.

La columna nullable `acontec_companies.test_plan` se añadió mediante `20261027233847_add_company_test_plan`. El servidor solo la aplica cuando el dueño conserva el rol real platform_admin y la empresa no es la de plataforma. Se consulta directamente el plan guardado, sin sustituirlo por DEFAULT_PLANS ni inicializar una suscripción. Colaboradores heredan estas restricciones junto con sus permisos individuales. El navegador solo solicita cambios por las rutas administrativas protegidas; no concede permisos al enviar un plan en una operación contable.

GET `/api/platform/test-companies` devuelve únicamente las empresas propias activas con prueba. POST `/api/platform/test-companies/create` y `/set` exigen sesión administrativa en la empresa de plataforma, sin colaborador, mismo origen, JSON, `confirmed: true` y motivo de al menos tres caracteres. El cambio incluye `previousPlan` para detectar ediciones simultáneas. La creación comparte la función normal y su bloqueo por usuario; los cambios bloquean la empresa, incrementan revisión y registran motivo y valores en auditoría. Nunca se marca una empresa de prueba como plataforma. Se rechazan empresas ajenas, archivadas, de plataforma y planes desconocidos.

No se consultan ni modifican pagos, autorizaciones o suscripciones desde estas rutas, ni se crean asientos o ingresos. La contratación, confirmación y cancelación comercial desde una empresa de prueba se rechazan. No se cambian precios, vigencias, variables ni datos de clientes. El límite de empresas se muestra como referencia: las empresas de prueba no se vuelven de consulta ni limitan la excepción administrativa de creación. Los límites de sucursales y módulos sí se aplican a lecturas, operaciones y guardados; los planes de una sucursal quedan en principal. Sin test_plan se conserva el comportamiento administrativo anterior.

Para revertir una prueba, quitar su plan desde Acontec con motivo y confirmación; conserva empresa, documentos y auditoría. No borrar tablas, columnas, datos ni migraciones.

### Lista de verificación — pendiente tras el despliegue

No se ejecutaron compilaciones, servidores ni pruebas locales. Las pruebas de reglas quedaron preparadas, no aprobadas. La revisión fue estática y no acredita funcionamiento al 100 % ni validación visual.

- [ ] Aplicar la migración durante el despliegue y comprobar rol real de Functions/RLS. Ejecutar las pruebas preparadas mediante la plataforma.
- [ ] Para cada plan, crear o abrir una empresa de prueba, cambiar el plan, volver a abrirla y comprobar menú lateral, barra inferior, panel, URL directa, API y guardados. Repetir con colaboradores y dos pestañas; verificar conflicto de revisión y previousPlan.
- [ ] Facturación: visibles ventas, clientes, compras, proveedores, gastos, costos, inventario, facturación y turnos, cobrar/pagar, Fiscal, Accesibilidad, ajustes y auditoría. Bloqueados contabilidad formal (diario, mayor, estados), Tesorería, Personal, Control del personal, Decisiones y Sucursales/traslados/comparar.
- [ ] Básico: como Facturación, además contabilidad formal, estados financieros y Tesorería, conservando Fiscal. Bloqueados Personal, Control del personal, Decisiones y Sucursales.
- [ ] Estándar: todo menos Sucursales; límite del plan de una empresa y solo principal. Las empresas de prueba conservan escritura por la excepción administrativa documentada.
- [ ] Pro: todos los módulos, sin límite del plan de empresas ni sucursales.
- [ ] En los tres primeros, intentar módulos bloqueados por URL/ruta y operaciones API: confirmar 403 «Tu plan no incluye…» en servidor y denegación de navegación en interfaz. Estándar solo bloquea Sucursales según su configuración inicial. Comparar siempre con la matriz guardada si se editaron los planes.
- [ ] Confirmar franja visible en cada pantalla, móvil y modo oscuro; insignia en Mis empresas y Mi suscripción sin botón «Elegir plan y pagar».
- [ ] Confirmar que crear/cambiar/quitar no genera cobro, pago, autorización, suscripción ni asiento en ninguna empresa. Revisar auditoría y ausencia de cambios en Acontec y clientes.
- [ ] Quitar el plan de prueba y comprobar acceso administrativo completo, conservando datos. Verificar también una empresa administrativa sin test_plan.
- [ ] Visitante 401; cliente real y colaborador 403 en todas las rutas de prueba; administrador fuera de Acontec 403. Rechazar empresa ajena/de plataforma, plan inválido, falta de motivo/confirmación, JSON incorrecto y origen ajeno.


### Corrección del desfase de revisión por plan de prueba

Cambiar o quitar `test_plan` conserva `companies.data` y `companies.revision`. La ruta consulta exclusivamente metadatos y compara `previousPlan` con el plan guardado bajo bloqueo de fila, también en el `UPDATE`, dentro de la transacción con auditoría. La revisión enviada por interfaces anteriores no interviene en el cambio de metadatos.

Al abrir una empresa afectada como dueño después del despliegue, la lectura transaccional repara automáticamente la revisión relacional, antes de leer la contabilidad. Solo se consideran empresas ajenas a plataforma con `test_plan` o nombre exacto «Empresa de prueba de plan», cuyo dueño conserve el rol real de super administrador. Bajo bloqueo de empresa y almacenamiento se verifica el hash canónico original de JavaScript, los conteos del manifiesto, la reconstrucción completa, los totales y las filas relacionales. Solo entonces se alinea `accounting_storage.revision` con `companies.revision` y se registra un evento de auditoría en la misma transacción. La reparación es idempotente y no cambia documentos, planes, copias, tablas ni migraciones. Si la verificación falla, se devuelve su error de integridad y la transacción no modifica nada.

La reparación de los datos de producción queda pendiente del despliegue y la reapertura por el dueño; no se ejecutó una actualización directa de producción en esta sesión. Quedaron pendientes para la plataforma la prueba de regresión de cambio/retiro, la reapertura de la empresa afectada, la auditoría única, el rechazo de un plan anterior obsoleto y la conservación del bloqueo ante diferencias de integridad.
